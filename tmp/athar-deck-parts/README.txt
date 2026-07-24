Contract for every slide fragment

1. Write exactly three <section class="slide"> elements, except the separately requested team slide.
2. Use data-slide with the final 1-based slide number.
3. Put the Masar logo in every slide:
   <div class="corner-logo"><img src="masar-logo.png" alt="شعار مسار"></div>
4. Put the page number in:
   <span class="slide-no">NN / 19</span>
5. Include a concise source footer with class="source".
6. Do not add global CSS, scripts, doctype, html, head, or body.
7. Use only classes from design-contract.css plus group-scoped classes prefixed gNN-.
8. Add a separate qa-NN-NN.txt with reviewed issues and fixes.
9. Never present illustrative model values, proposed thresholds, or external benchmarks as field results.
10. Keep titles on one or two lines and avoid body text smaller than 18px.
