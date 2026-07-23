/**
 * AtharRouting — real alternative-route computation on a local road network.
 * Pure computation: no DOM, no fetch, no Date.now(). Shared verbatim by the
 * browser UI and the Node test suite (same UMD pattern as athar-engine.js).
 *
 * The network geometry is digitized from OpenStreetMap (© OpenStreetMap
 * contributors, ODbL). Lane/capacity/free-flow/demand values are demo
 * assumptions (افتراض توضيحي للعرض) meant to be calibrated with operator data.
 *
 * UMD export: `window.AtharRouting` in the browser, `module.exports` in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharRouting = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Typical urban weekday distribution (fraction of daily AADT per hour).
  // افتراض توضيحي للعرض — shape only, not a measured KSA count. Mirrors the
  // engine profile so routing and scoring agree on when peaks occur.
  var HOURLY_PROFILE = [
    0.010, 0.007, 0.005, 0.005, 0.007, 0.015,
    0.035, 0.070, 0.080, 0.060, 0.045, 0.045,
    0.048, 0.045, 0.045, 0.048, 0.058, 0.075,
    0.090, 0.070, 0.050, 0.038, 0.028, 0.021
  ];

  // BPR parameters (Bureau of Public Roads volume-delay function).
  var BPR_ALPHA = 0.15;
  var BPR_BETA = 4;

  // When lanesClosed >= lanes, keep this fraction of one lane so BPR never
  // divides by zero. افتراض توضيحي للعرض.
  var MIN_CAPACITY_FRACTION = 0.25;

  // Penalty multiplier applied to an already-used route's edges to force the
  // next-shortest path to diverge (k-diverse alternatives). افتراض توضيحي.
  var DIVERSITY_PENALTY = 1.6;

  // POI is "near" a route if any route node lies within this distance (km).
  var POI_NEAR_KM = 0.25;

  var EARTH_RADIUS_KM = 6371;

  function toRad(deg) { return (deg * Math.PI) / 180; }

  // Haversine great-circle distance in km between two [lat,lng] points.
  function haversineKm(aLat, aLng, bLat, bLng) {
    var dLat = toRad(bLat - aLat);
    var dLng = toRad(bLng - aLng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat))
      * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /**
   * Build a bidirectional adjacency graph from the network file.
   * @param {object} network
   * @returns {{adj:Object, edgeById:Object, nodes:Object, network:object}}
   */
  function buildGraph(network) {
    var nodes = network.nodes;
    var adj = {};
    var edgeById = {};

    Object.keys(nodes).forEach(function (id) { adj[id] = []; });

    network.edges.forEach(function (raw) {
      var a = nodes[raw.from];
      var b = nodes[raw.to];
      var lengthKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
      var edge = {
        id: raw.id,
        from: raw.from,
        to: raw.to,
        name: raw.name,
        lanes: raw.lanes,
        capacityPerLane: raw.capacityPerLane,
        freeFlowKmh: raw.freeFlowKmh,
        demandShare: raw.demandShare,
        lengthKm: lengthKm
      };
      edgeById[raw.id] = edge;
      // Bidirectional: same edge id usable in either travel direction.
      adj[raw.from].push({ to: raw.to, edgeId: raw.id });
      adj[raw.to].push({ to: raw.from, edgeId: raw.id });
    });

    return { adj: adj, edgeById: edgeById, nodes: nodes, network: network };
  }

  function hourFractionOf(hour) {
    return HOURLY_PROFILE[((hour % 24) + 24) % 24];
  }

  /**
   * BPR travel time (minutes) for one edge at a given demand hour, honoring an
   * optional closure on that edge.
   * @param {object} edge - from buildGraph().edgeById
   * @param {number} hourFraction - fraction of daily AADT in this hour
   * @param {number} aadtScale - network AADT scale
   * @param {?{edgeId:string, lanesClosed:number}} closure
   * @returns {number} minutes
   */
  function edgeTravelTime(edge, hourFraction, aadtScale, closure) {
    var t0 = (edge.lengthKm / edge.freeFlowKmh) * 60;
    var fullCapacity = edge.lanes * edge.capacityPerLane;

    var capacity = fullCapacity;
    if (closure && closure.edgeId === edge.id && closure.lanesClosed > 0) {
      var openLanes = Math.max(0, edge.lanes - closure.lanesClosed);
      capacity = Math.max(openLanes * edge.capacityPerLane,
        MIN_CAPACITY_FRACTION * edge.capacityPerLane);
    }

    var volume = edge.demandShare * aadtScale * hourFraction;
    return travelTimeForVolume(edge, volume, capacity);
  }

  function travelTimeForVolume(edge, volume, capacity) {
    var t0 = (edge.lengthKm / edge.freeFlowKmh) * 60;
    var ratio = volume / (capacity > 0 ? capacity : 1e-9);
    return t0 * (1 + BPR_ALPHA * Math.pow(ratio, BPR_BETA));
  }

  /**
   * Dijkstra shortest path by travel time.
   * @param {object} graph - from buildGraph()
   * @param {string} from
   * @param {string} to
   * @param {number} hour - 0..23
   * @param {?{edgeId:string, lanesClosed:number}} closure
   * @param {{forbidEdges?:Object, penaltyEdges?:Object}} [opts]
   * @returns {?{path:Array<string>, edges:Array<string>, travelMin:number}}
   */
  function shortestPath(graph, from, to, hour, closure, opts) {
    opts = opts || {};
    var forbid = opts.forbidEdges || {};
    var penalty = opts.penaltyEdges || {};
    var aadtScale = graph.network.metadata.aadtScale;
    var hf = hourFractionOf(hour);

    var dist = {};
    var prev = {};
    var prevEdge = {};
    var visited = {};
    Object.keys(graph.adj).forEach(function (n) { dist[n] = Infinity; });
    dist[from] = 0;

    // Simple O(V^2) selection — network is tiny (<50 nodes).
    while (true) {
      var u = null;
      var best = Infinity;
      Object.keys(dist).forEach(function (n) {
        if (!visited[n] && dist[n] < best) { best = dist[n]; u = n; }
      });
      if (u === null) break;
      if (u === to) break;
      visited[u] = true;

      graph.adj[u].forEach(function (nb) {
        if (forbid[nb.edgeId]) return;
        var edge = graph.edgeById[nb.edgeId];
        var w = edgeTravelTime(edge, hf, aadtScale, closure);
        if (penalty[nb.edgeId]) w *= DIVERSITY_PENALTY;
        var alt = dist[u] + w;
        if (alt < dist[nb.to]) {
          dist[nb.to] = alt;
          prev[nb.to] = u;
          prevEdge[nb.to] = nb.edgeId;
        }
      });
    }

    if (dist[to] === Infinity) return null;

    var path = [];
    var edges = [];
    var cur = to;
    while (cur !== undefined && cur !== from) {
      path.unshift(cur);
      edges.unshift(prevEdge[cur]);
      cur = prev[cur];
    }
    path.unshift(from);

    return { path: path, edges: edges, travelMin: dist[to] };
  }

  function poisNearPath(network, graph, path) {
    var out = [];
    (network.pois || []).forEach(function (poi) {
      var minKm = Infinity;
      path.forEach(function (nodeId) {
        var n = graph.nodes[nodeId];
        var d = haversineKm(n.lat, n.lng, poi.lat, poi.lng);
        if (d < minKm) minKm = d;
      });
      if (minKm <= POI_NEAR_KM) {
        out.push({ id: poi.id, kind: poi.kind, name: poi.name, distanceKm: minKm });
      }
    });
    return out;
  }

  // Tightest residual capacity along a route (% of capacity still free on its
  // busiest edge). Lower = more fragile alternative.
  function residualCapacityPct(graph, edges, hour) {
    var aadtScale = graph.network.metadata.aadtScale;
    var hf = hourFractionOf(hour);
    var worst = 100;
    edges.forEach(function (eid) {
      var edge = graph.edgeById[eid];
      var cap = edge.lanes * edge.capacityPerLane;
      var vol = edge.demandShare * aadtScale * hf;
      var free = Math.max(0, (1 - vol / cap) * 100);
      if (free < worst) worst = free;
    });
    return worst;
  }

  function routeLoadMetrics(graph, edges, hour, assignedDivertedVehiclesPerHour) {
    var aadtScale = graph.network.metadata.aadtScale;
    var hf = hourFractionOf(hour);
    var freeFlowMinutes = 0;
    var travelMinutes = 0;
    var maxBaseVolume = 0;
    var maxVolumeCapacityRatio = 0;
    var tightestResidualCapacity = Infinity;

    edges.forEach(function (eid) {
      var edge = graph.edgeById[eid];
      var capacity = edge.lanes * edge.capacityPerLane;
      var baseVolume = edge.demandShare * aadtScale * hf;
      var loadedVolume = baseVolume + assignedDivertedVehiclesPerHour;
      var freeFlow = (edge.lengthKm / edge.freeFlowKmh) * 60;
      var ratio = loadedVolume / (capacity > 0 ? capacity : 1e-9);

      freeFlowMinutes += freeFlow;
      travelMinutes += travelTimeForVolume(edge, loadedVolume, capacity);
      if (baseVolume > maxBaseVolume) maxBaseVolume = baseVolume;
      if (ratio > maxVolumeCapacityRatio) maxVolumeCapacityRatio = ratio;
      tightestResidualCapacity = Math.min(
        tightestResidualCapacity,
        capacity - loadedVolume
      );
    });

    return {
      freeFlowMinutes: freeFlowMinutes,
      travelMinutes: travelMinutes,
      baseVolumePerHour: maxBaseVolume,
      loadedVolumePerHour: maxBaseVolume + assignedDivertedVehiclesPerHour,
      volumeCapacityRatio: maxVolumeCapacityRatio,
      residualCapacity: tightestResidualCapacity
    };
  }

  // Endpoints spanning the closed edge: route from the corridor start node to
  // the corridor end node so alternatives must genuinely bypass the closure.
  function corridorEndpoints(network) {
    var ce = network.corridorEdges;
    var firstEdge = network.edges.filter(function (e) { return e.id === ce[0]; })[0];
    var lastEdge = network.edges.filter(function (e) { return e.id === ce[ce.length - 1]; })[0];
    return { from: firstEdge.from, to: lastEdge.to };
  }

  // Straight-through travel time along the corridor (kf edges only), honoring
  // the closure. This is what a driver who STAYS on the main road suffers —
  // as opposed to the network shortest path, which would silently divert.
  function corridorThroughTime(graph, network, hour, closure) {
    var hf = hourFractionOf(hour);
    var aadtScale = graph.network.metadata.aadtScale;
    var total = 0;
    network.corridorEdges.forEach(function (eid) {
      total += edgeTravelTime(graph.edgeById[eid], hf, aadtScale, closure);
    });
    return total;
  }

  /**
   * Compute alternative routes around a closed corridor edge.
   * @param {object} network
   * @param {string} closedEdgeId
   * @param {number} hour - 0..23
   * @param {{lanesClosed?:number, k?:number}} [opts]
   * @returns {{viaClosureMin:number, baselineMin:number, alternatives:Array}}
   */
  function alternativeRoutes(network, closedEdgeId, hour, opts) {
    opts = opts || {};
    var lanesClosed = opts.lanesClosed || 2;
    var k = opts.k || 3;
    var graph = buildGraph(network);
    var ends = corridorEndpoints(network);
    var closure = { edgeId: closedEdgeId, lanesClosed: lanesClosed };
    var closedEdge = graph.edgeById[closedEdgeId];
    var closedDemandPerHour = closedEdge.demandShare
      * network.metadata.aadtScale
      * hourFractionOf(hour);
    // Illustrative allocation rule: the share of demand associated with the
    // closed lanes is diverted. This is explicit demo logic, not a measured
    // driver-choice calibration.
    var divertedVehiclesPerHour = closedDemandPerHour * Math.min(
      1,
      Math.max(0, lanesClosed / closedEdge.lanes)
    );

    // Straight-through corridor time with no closure (normal day) and with the
    // closure active (what a driver suffers if they stay on the main road).
    var baselineMin = corridorThroughTime(graph, network, hour, null);
    var viaClosureMin = corridorThroughTime(graph, network, hour, closure);

    // k-diverse alternatives: forbid the closed edge; penalize already-used
    // edges so each successive route diverges.
    var forbid = {}; forbid[closedEdgeId] = true;
    var penalty = {};
    var alternatives = [];
    var seen = {};

    for (var i = 0; i < k; i += 1) {
      var r = shortestPath(graph, ends.from, ends.to, hour, closure, {
        forbidEdges: forbid,
        penaltyEdges: penalty
      });
      if (!r) break;
      var key = r.path.join('>');
      if (!seen[key]) {
        seen[key] = true;
        // True (unpenalized) travel time for display/ranking.
        var trueTime = 0;
        var hf = hourFractionOf(hour);
        r.edges.forEach(function (eid) {
          trueTime += edgeTravelTime(graph.edgeById[eid], hf, graph.network.metadata.aadtScale, closure);
        });
        alternatives.push({
          path: r.path,
          edges: r.edges,
          streets: r.edges.map(function (eid) { return graph.edgeById[eid].name; }),
          travelMin: trueTime,
          extraMin: trueTime - baselineMin,
          nearPois: poisNearPath(network, graph, r.path)
        });
      }
      // Penalize this route's edges for the next iteration.
      r.edges.forEach(function (eid) { penalty[eid] = true; });
    }

    var weightTotal = alternatives.reduce(function (sum, route) {
      route._allocationWeight = 1 / Math.max(route.travelMin, 1e-9);
      return sum + route._allocationWeight;
    }, 0);

    alternatives.forEach(function (route) {
      var diversionShare = weightTotal > 0
        ? route._allocationWeight / weightTotal
        : 0;
      var assigned = divertedVehiclesPerHour * diversionShare;
      var before = routeLoadMetrics(graph, route.edges, hour, 0);
      var after = routeLoadMetrics(graph, route.edges, hour, assigned);

      route.diversionShare = diversionShare;
      route.assignedDivertedVehiclesPerHour = assigned;
      route.baseVolumePerHour = before.baseVolumePerHour;
      route.loadedVolumePerHour = after.loadedVolumePerHour;
      route.freeFlowMinutes = before.freeFlowMinutes;
      route.travelTimeBeforeDiversion = before.travelMinutes;
      route.travelTimeAfterDiversion = after.travelMinutes;
      route.volumeCapacityRatioBeforeDiversion = before.volumeCapacityRatio;
      route.volumeCapacityRatioAfterDiversion = after.volumeCapacityRatio;
      route.residualCapacityBeforeDiversion = before.residualCapacity;
      route.residualCapacityAfterDiversion = after.residualCapacity;
      route.residualCapacityPct = Math.max(
        0,
        (1 - after.volumeCapacityRatio) * 100
      );
      route.recommended = after.volumeCapacityRatio < 1;
      route.recommendationReason = route.recommended
        ? 'capacity-available-after-diversion'
        : 'capacity-exceeded-after-diversion';
      route.travelMin = after.travelMinutes;
      route.extraMin = after.travelMinutes - baselineMin;
      delete route._allocationWeight;
    });

    alternatives.sort(function (a, b) {
      return a.travelTimeAfterDiversion - b.travelTimeAfterDiversion;
    });

    return {
      viaClosureMin: viaClosureMin,
      baselineMin: baselineMin,
      divertedVehiclesPerHour: divertedVehiclesPerHour,
      allocationAssumption: 'inverse-travel-time illustrative split; not measured behavior',
      alternatives: alternatives
    };
  }

  /**
   * Queue-spillover (shockwave) model: when a closure pushes the closed edge's
   * v/c above 1, the excess demand cannot pass and spills onto edges adjacent
   * to the closed edge's endpoints. Returns per-edge overflow ratios.
   * @param {object} network
   * @param {string} closedEdgeId
   * @param {number} hour
   * @param {{lanesClosed?:number}} [opts]
   * @returns {{excessVehPerHour:number, overflow:Object}}
   */
  function shockwave(network, closedEdgeId, hour, opts) {
    opts = opts || {};
    var lanesClosed = opts.lanesClosed || 2;
    var graph = buildGraph(network);
    var aadtScale = network.metadata.aadtScale;
    var hf = hourFractionOf(hour);
    var closed = graph.edgeById[closedEdgeId];

    var openLanes = Math.max(0, closed.lanes - lanesClosed);
    var reducedCap = Math.max(openLanes * closed.capacityPerLane,
      MIN_CAPACITY_FRACTION * closed.capacityPerLane);
    var demand = closed.demandShare * aadtScale * hf;
    var excess = Math.max(0, demand - reducedCap);

    var overflow = {};
    if (excess > 0) {
      // Adjacent edges = edges touching either endpoint of the closed edge,
      // excluding the closed edge itself. Excess is split by their capacity.
      var neighborIds = [];
      [closed.from, closed.to].forEach(function (node) {
        graph.adj[node].forEach(function (nb) {
          if (nb.edgeId !== closedEdgeId && neighborIds.indexOf(nb.edgeId) < 0) {
            neighborIds.push(nb.edgeId);
          }
        });
      });
      var totalNeighborCap = 0;
      neighborIds.forEach(function (eid) {
        var e = graph.edgeById[eid];
        totalNeighborCap += e.lanes * e.capacityPerLane;
      });
      neighborIds.forEach(function (eid) {
        var e = graph.edgeById[eid];
        var cap = e.lanes * e.capacityPerLane;
        var share = totalNeighborCap > 0 ? (cap / totalNeighborCap) * excess : 0;
        var baseVol = e.demandShare * aadtScale * hf;
        overflow[eid] = (baseVol + share) / cap; // new v/c after absorbing spill
      });
    }

    return { excessVehPerHour: excess, overflow: overflow };
  }

  return {
    HOURLY_PROFILE: HOURLY_PROFILE,
    haversineKm: haversineKm,
    buildGraph: buildGraph,
    edgeTravelTime: edgeTravelTime,
    shortestPath: shortestPath,
    alternativeRoutes: alternativeRoutes,
    shockwave: shockwave,
    hourFractionOf: hourFractionOf
  };
});
