// Self-contained renderer shared by the web canvas and the offline native WebView.
// Motion comes from JcToon's original Teddy rig; the stoat artwork is the approved local SVG.
export function createFireflyController(runtime, canvas, source, notify) {
  let engine, file, artboard, machine, nodes, inputs, frame;
  let disposed = false, hidden = false, loaded = false, lastTime = 0, clock = 0;
  let target = { lookingAway: false, watching: false, progress: 0, reducedMotion: true };
  let smoothLook = 50;
  let errorAmount = 0;
  let greetingStarted = -1, greetingPlayed = false, greetingSequence = -1, waveAmount = 0;
  const earDrop = 0;
  const abort = new AbortController();
  const context = canvas.getContext('2d');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smoothstep = value => { value = clamp(value, 0, 1);return value * value * (3 - 2 * value); };
  const greetingWave = elapsed => {
    const waveTime = Math.max(0, elapsed - 0.48);
    const window = smoothstep(waveTime / 0.18) * (1 - smoothstep((waveTime - 1.22) / 0.28));
    return Math.sin(waveTime * Math.PI * 4.8) * 0.22 * window;
  };
  const shapes = {};
  function path(name, definition, color) {
    shapes[name] ||= new Path2D(definition);
    context.fillStyle = color;
    context.fill(shapes[name]);
  }
  function oval(x, y, rx, ry, color, rotation = 0) {
    context.beginPath(); context.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    context.fillStyle = color; context.fill();
  }
  function transform(node) {
    const matrix = node.worldTransform();
    const result = { x: matrix.tx, y: matrix.ty, xx: matrix.xx, yy: matrix.yy };
    matrix.delete();
    return result;
  }
  function pose() {
    const head = transform(nodes.head), hand = transform(nodes.hand);
    const pupil = transform(nodes.pupil), left = transform(nodes.left), right = transform(nodes.right);
    const top = transform(nodes.lidTop), bottom = transform(nodes.lidBottom);
    return {
      // These bounds map the original rig's measured hand-down / hand-up positions.
      cover: clamp((741.33 - hand.y) / 526.28, 0, 1),
      x: clamp((head.x - 398.6) * 0.19, -5, 5),
      y: clamp((head.y - 312.67) * 0.055, -3, 3),
      pupilX: clamp((pupil.x - (left.x + right.x) / 2 - 0.12) * 0.8, -5, 5),
      pupilY: clamp((pupil.y - (left.y + right.y) / 2 + 12.68) * 0.4, -2, 5),
      blink: clamp((bottom.y - top.y) / 29.36, 0.06, 1),
    };
  }
  const mascotArtwork = {"tag":"svg","id":"","children":[{"tag":"g","id":"character","children":[{"tag":"g","id":"tail","children":[{"tag":"path","id":"tail-fur","children":[],"d":"M268 586.780 C230 599.336 200 577.998 184 542.844 C174 516.750 175 479.771 189 443.572 C199 412.711 214 391.081 227 376.826 C208 345.743 182 325.505 157 327.000 C112 327.000 78 355.000 58 397.000 C39 436.000 36 475.000 49 520.967 C64 571.341 96 610.858 140 636.807 C181 659.622 220 663.809 258 658.102 L286 642.804 Z","fill":"#FCEDE0"},{"tag":"path","id":"tail-shadow","children":[],"d":"M46 494.171 C54 539.267 84 583.075 123 607.984 C164 630.483 203 636.213 234 629.130 L267 624.897 L270 653.994 C229 667.511 176 660.095 134 634.836 C84 603.135 53 555.253 46 514.113 Z","fill":"#F7E0C7"},{"tag":"g","id":"tail-tip","children":[{"tag":"path","id":"tail-tip-shape","children":[],"d":"M43 472.113 C37 446.000 47 404.000 66 377.000 C89 343.000 122 327.000 157 327.000 C184 327.341 211 349.048 227 376.826 C203 402.223 185 433.412 179 470.419 C175 484.845 164 497.135 154 488.253 C150 484.639 147 475.017 146 469.679 C132 481.649 117 496.009 104 488.864 C95 484.206 89 467.349 84 459.218 C78 460.417 72 479.474 65 483.447 C57 487.939 54 470.257 51 461.761 L43 476.753 Z","fill":"#343232"}]}]},{"tag":"g","id":"paw-hind-left","children":[{"tag":"path","id":"haunch-left","children":[],"d":"M257 507 C230 513 213 541 212 570 C211 604 224 629 240 646 C256 652 273 647 281 638 C268 607 261 568 257 507 Z","fill":"#FAE7D3"},{"tag":"path","id":"hind-left-shadow","children":[],"d":"M257 509 C261 552 268 602 280 635 C267 635 251 640 243 650 C230 639 224 625 222 610 C231 627 246 637 261 636 C249 608 248 556 257 509 Z","fill":"#F2D7B8"},{"tag":"path","id":"hind-left-foot","children":[],"d":"M249 645 C263 640 285 647 292 658 C302 674 282 684 263 683 C244 684 231 679 232 666 C234 656 239 649 249 645 Z","fill":"#F9B08E"}]},{"tag":"g","id":"paw-hind-right","children":[{"tag":"path","id":"hind-right-gap-fill","children":[],"d":"M470 500 C466 545 453 593 438 634 L429 665 C447 674 465 653 474 628 C485 595 486 551 479 519 Z","fill":"#FAE7D3"},{"tag":"path","id":"haunch-right","children":[],"d":"M473 506 C496 517 513 544 514 570 C514 599 501 628 488 647 C471 653 456 647 448 637 C462 607 472 560 473 506 Z","fill":"#FAE7D3"},{"tag":"path","id":"hind-right-shadow","children":[],"d":"M473 506 C480 550 477 601 451 641 C448 646 444 650 438 654 C443 626 453 591 461 553 C466 531 470 515 473 506 Z","fill":"#F2D7B8"},{"tag":"path","id":"hind-right-foot","children":[],"d":"M456 649 C471 639 491 647 498 660 C508 677 491 684 473 683 C456 683 442 676 444 666 C446 658 450 653 456 649 Z","fill":"#F9B08E"}]},{"tag":"g","id":"body","children":[{"tag":"path","id":"body-neck","children":[],"d":"M284 303 C321 315 411 320 438 304 C449 339 449 369 461 404 C473 442 480 474 472 514 C465 559 447 609 439 650 C418 680 321 681 287 660 C271 623 260 574 259 529 C253 485 257 439 269 398 C281 364 278 329 284 303 Z","fill":"#FCEDE0"},{"tag":"path","id":"body-left-shade","children":[],"d":"M262 507 C260 548 267 599 278 636 L302 655 L293 673 C275 648 264 616 260 577 C254 547 255 521 262 507 Z","fill":"#F1D4B9"},{"tag":"path","id":"foreleg-left-shadow","children":[],"d":"M337 505 C345 523 352 540 366 550 C380 539 387 523 395 504 C390 551 388 612 385 669 C372 670 363 670 351 669 C350 609 345 556 337 505 Z","fill":"#F1D4B9"},{"tag":"g","id":"privacy-body-shadows","children":[{"tag":"path","id":"privacy-armpit-left","d":"M286 388 C289 410 282 431 267 440 C264 450 261 463 261 476 C272 461 283 443 289 424 C293 409 291 397 286 388 Z","fill":"url(#armpit-shade-left)","children":[]},{"tag":"path","id":"privacy-armpit-right","d":"M439 388 C436 410 443 431 458 440 C461 450 464 463 464 476 C453 461 442 443 436 424 C432 409 434 397 439 388 Z","fill":"url(#armpit-shade-right)","children":[]},{"tag":"path","id":"privacy-thigh-left","d":"M258 510 C277 542 294 594 297 648 C297 656 294 661 290 664 C285 650 283 630 279 606 C274 568 266 535 258 510 Z","fill":"url(#thigh-shade-left)","children":[]},{"tag":"path","id":"privacy-thigh-right","d":"M472 510 C453 542 436 594 433 648 C433 656 436 661 440 664 C445 650 447 630 451 606 C456 568 464 535 472 510 Z","fill":"url(#thigh-shade-right)","children":[]}]}]},{"tag":"g","id":"paw-front-left","children":[{"tag":"path","id":"foreleg-left","children":[],"d":"M278 385 C286 428 306 478 323 514 C337 554 342 608 348 659 C354 679 344 689 324 688 C307 689 295 684 294 675 C285 645 279 616 273 584 C266 549 262 523 260 502 C258 466 264 415 278 385 Z","fill":"#FCEDE0"},{"tag":"path","id":"forefoot-left","children":[],"d":"M300 660 C310 652 332 651 344 661 C354 670 349 682 337 686 C323 690 303 686 298 679 C294 672 295 665 300 660 Z","fill":"#FCEDE0"},{"tag":"path","id":"moving-toe-312","d":"M312 663 C308 671 309 680 312 683 L315 683 C313 674 314 669 316 664 Z ","fill":"#E5A17F","children":[]},{"tag":"path","id":"moving-toe-333","d":"M333 664 C330 671 331 681 334 685 L337 684 C334 676 336 669 337 665 Z ","fill":"#E5A17F","children":[]},{"tag":"path","id":"palm-definition-left","d":"M263 233 C275 203 295 185 317 194 C337 201 347 222 336 243 C331 252 320 264 306 271 L304 267 C318 260 327 249 332 240 C341 222 333 204 316 198 C297 190 279 208 267 235 Z","fill":"#D3A079","children":[]}]},{"tag":"g","id":"paw-front-right","children":[{"tag":"path","id":"foreleg-right","children":[],"d":"M451 386 C471 427 479 474 470 525 C461 576 447 630 438 660 C443 674 438 685 422 687 C405 691 387 685 385 676 C383 646 389 601 390 567 C392 521 413 475 429 439 C439 418 446 398 451 386 Z","fill":"#FCEDE0"},{"tag":"path","id":"forefoot-right","children":[],"d":"M391 659 C401 653 424 653 434 665 C444 679 432 687 417 688 C402 690 388 683 386 676 C384 669 387 663 391 659 Z","fill":"#FCEDE0"},{"tag":"path","id":"moving-toe-400","d":"M400 664 C397 672 398 681 402 684 L405 684 C401 676 402 670 404 666 Z ","fill":"#E5A17F","children":[]},{"tag":"path","id":"moving-toe-422","d":"M422 665 C420 673 421 680 425 684 L428 683 C424 676 425 670 427 666 Z ","fill":"#E5A17F","children":[]},{"tag":"path","id":"palm-definition-right","d":"M462 233 C450 203 430 185 408 194 C388 201 378 222 389 243 C394 252 405 264 419 271 L421 267 C407 260 398 249 393 240 C384 222 392 204 409 198 C428 190 446 208 458 235 Z","fill":"#D3A079","children":[]}]},{"tag":"g","id":"toe-details","children":[{"tag":"path","id":"toes-left","children":[],"d":"M249 659 C246 665 245 676 249 680 L252 680 C249 672 251 665 253 660 Z  M272 660 C268 668 269 678 273 682 L276 681 C273 673 274 668 276 662 Z  M461 662 C459 669 461 678 465 682 L468 681 C464 675 464 668 465 663 Z  M483 662 C484 670 486 675 484 680 L487 680 C490 674 488 667 486 662 Z","fill":"#E5A17F"}]},{"tag":"g","id":"head","children":[{"tag":"path","id":"head-shape","children":[],"d":"M224 183 C240 140 273 109 307 98 C335 88 384 89 416 98 C451 110 479 141 495 183 C501 199 509 211 511 231 C516 258 501 277 478 291 C447 311 407 320 366 320 C315 320 269 308 239 289 C214 273 203 253 208 231 C212 212 218 198 224 183 Z","fill":"#FCEDE0"},{"tag":"g","id":"privacy-face-shadows","children":[{"tag":"path","id":"privacy-cheek-left","d":"M272 418 C242 395 225 358 229 316 C232 279 252 247 268 210 C279 181 301 158 324 173 C347 182 352 207 340 226 C334 240 321 250 307 254 C292 290 288 333 291 367 C292 393 286 409 272 418 Z","fill":"url(#face-shade-left)","children":[]},{"tag":"path","id":"privacy-cheek-right","d":"M453 418 C483 395 500 358 496 316 C493 279 473 247 457 210 C446 181 424 158 401 173 C378 182 373 207 385 226 C391 240 404 250 418 254 C433 290 437 333 434 367 C433 393 439 409 453 418 Z","fill":"url(#face-shade-right)","children":[]}]},{"tag":"g","id":"ear-left","children":[{"tag":"path","id":"ear-left-outer","children":[],"d":"M224 185 C207 171 192 150 193 124 C193 94 210 65 234 62 C261 60 287 80 307 98 C289 104 276 113 275 120 C253 135 235 160 224 185 Z","fill":"#FCEDE0"},{"tag":"path","id":"ear-left-inner","children":[],"d":"M220 172 C207 158 201 139 202 120 C203 99 215 80 232 80 C248 79 266 95 275 113 C251 119 231 147 220 172 Z","fill":"#F9B08E"},{"tag":"path","id":"ear-left-fold","children":[],"d":"M220 173 C222 145 247 120 275 113 C258 108 227 137 220 173 Z","fill":"#EEA381"}]},{"tag":"g","id":"ear-right","children":[{"tag":"path","id":"ear-right-outer","children":[],"d":"M490 186 C509 166 520 143 519 121 C518 94 503 67 482 63 C459 59 435 77 417 98 C427 102 435 110 438 120 C462 136 479 159 490 186 Z","fill":"#FCEDE0"},{"tag":"path","id":"ear-right-inner","children":[],"d":"M493 172 C505 155 511 138 509 119 C507 98 496 81 481 80 C465 78 448 96 439 114 C462 121 482 146 493 172 Z","fill":"#F9B08E"},{"tag":"path","id":"ear-right-fold","children":[],"d":"M493 173 C483 146 462 125 439 114 C458 109 486 140 493 173 Z","fill":"#EEA381"}]},{"tag":"g","id":"brows","children":[{"tag":"path","id":"brow-left","children":[],"d":"M284 142 C286 131 300 125 310 131 C316 135 319 140 317 142 C306 137 295 136 284 142 Z","fill":"#23211D"},{"tag":"path","id":"brow-right","children":[],"d":"M405 141 C408 131 418 127 428 132 C433 135 437 139 438 142 C427 137 415 136 405 141 Z","fill":"#23211D"}]},{"tag":"g","id":"eyes","children":[{"tag":"g","id":"eye-left","children":[{"tag":"path","id":"eye-left-shape","children":[],"d":"M258 198 C255 177 272 155 291 155 C314 153 333 176 334 201 C337 222 320 233 299 232 C276 232 257 220 258 198 Z","fill":"#161515"},{"tag":"path","id":"eye-left-white","children":[],"d":"M264 198 C262 179 275 161 291 161 C310 159 328 180 329 200 C332 218 319 227 299 227 C280 227 264 217 264 198 Z","fill":"#FFFFFF"},{"tag":"g","id":"pupil-left-clip","children":[{"tag":"g","id":"pupil-left","children":[{"tag":"path","id":"pupil-left-shape","children":[],"d":"M306 165 C322 168 331 184 331 201 C331 216 324 227 313 227 C294 226 282 215 283 195 C283 178 292 165 306 165 Z","fill":"#161515"},{"tag":"path","id":"pupil-left-highlight","children":[],"d":"M307 179 C311 176 318 180 317 185 C316 190 308 190 307 186 C306 184 305 181 307 179 Z","fill":"#FFFFFF"}]}]}]},{"tag":"g","id":"eye-right","children":[{"tag":"path","id":"eye-right-shape","children":[],"d":"M467 198 C470 177 453 155 434 155 C411 153 392 176 391 201 C388 222 405 233 426 232 C449 232 468 220 467 198 Z","fill":"#161515"},{"tag":"path","id":"eye-right-white","children":[],"d":"M461 198 C463 179 450 161 434 161 C415 159 397 180 396 200 C393 218 406 227 426 227 C445 227 461 217 461 198 Z","fill":"#FFFFFF"},{"tag":"g","id":"pupil-right-clip","children":[{"tag":"g","id":"pupil-right","children":[{"tag":"path","id":"pupil-right-shape","children":[],"d":"M419 165 C403 168 394 184 394 201 C394 216 401 227 412 227 C431 226 443 215 442 195 C442 178 433 165 419 165 Z","fill":"#161515"},{"tag":"path","id":"pupil-right-highlight","children":[],"d":"M418 179 C414 176 407 180 408 185 C409 190 417 190 418 186 C419 184 420 181 418 179 Z","fill":"#FFFFFF"}]}]}]}]},{"tag":"g","id":"nose","children":[{"tag":"path","id":"nose-shape","children":[],"d":"M345 216 C354 210 378 210 386 217 C393 223 380 234 367 240 C352 235 341 228 345 216 Z","fill":"#161515"},{"tag":"path","id":"nose-highlight","children":[],"d":"M355 216 C361 214 374 214 379 217 C371 220 362 219 355 218 Z","fill":"#37423B"}]},{"tag":"g","id":"mouth","children":[{"tag":"path","id":"mouth-shape","children":[],"d":"M322 248 C332 261 346 262 357 256 L365 249 L365 237 L368 237 L369 249 C380 264 397 260 405 248 C406 253 400 262 392 264 C379 269 371 260 366 256 C356 267 339 267 329 259 Z","fill":"#B86F50"}]},{"tag":"g","id":"whiskers-left","children":[{"tag":"path","id":"whisker-left-top","children":[],"d":"M281 232 C252 222 218 218 188 228 C219 224 250 228 281 235 Z","fill":"#F0B491"},{"tag":"path","id":"whisker-left-bottom","children":[],"d":"M282 242 C251 242 214 250 184 264 C219 253 251 247 282 245 Z","fill":"#F0B491"}]},{"tag":"g","id":"whiskers-right","children":[{"tag":"path","id":"whisker-right-top","children":[],"d":"M452 232 C480 221 510 219 535 229 C505 225 478 228 452 235 Z","fill":"#F0B491"},{"tag":"path","id":"whisker-right-bottom","children":[],"d":"M452 242 C481 243 513 252 536 265 C507 254 481 248 452 245 Z","fill":"#F0B491"}]}]},{"tag":"g","id":"scarf-back","children":[{"tag":"path","id":"scarf-end","children":[],"d":"M277 317 C255 300 229 303 209 314 C195 322 183 335 177 346 C202 352 213 366 237 363 C251 363 267 353 280 346 Z","fill":"#02723A"},{"tag":"path","id":"scarf-end-shadow","children":[],"d":"M271 344 C244 351 232 376 233 403 C250 399 264 386 271 372 L286 347 Z","fill":"#08703A"},{"tag":"path","id":"scarf-end-fold","children":[],"d":"M245 321 C251 315 264 317 274 324 C265 332 247 333 239 325 Z","fill":"#005D2E"}]},{"tag":"g","id":"scarf","children":[{"tag":"path","id":"scarf-collar","children":[],"d":"M279 313 C292 327 334 339 368 348 C393 339 425 331 442 314 C449 320 452 334 447 346 C438 365 406 365 372 360 C341 359 305 347 281 338 Z","fill":"#006D36"},{"tag":"path","id":"scarf-front","children":[],"d":"M278 334 C300 348 337 358 368 359 C400 357 430 347 447 340 C458 352 459 370 451 389 C438 420 406 453 372 477 C340 459 308 434 285 407 C273 393 269 369 274 350 Z","fill":"#02723A"},{"tag":"path","id":"scarf-fold","children":[],"d":"M277 339 C283 348 295 357 305 360 C295 353 286 344 282 337 Z","fill":"#005D2E"},{"tag":"path","id":"location-pin","children":[],"d":"M345 392 C342 376 357 363 373 367 C391 369 402 385 395 402 C389 414 379 425 372 434 C364 425 348 407 345 392 Z M358 391 C358 401 369 410 378 404 C391 396 386 382 375 380 C365 378 359 382 358 391 Z","fill":"#FFFFFF"}]},{"tag":"g","id":"scarf-knot-layer","children":[{"tag":"path","id":"scarf-knot","children":[],"d":"M275 322 C282 318 289 326 292 335 C291 344 282 350 275 345 C270 340 271 329 275 322 Z","fill":"#006433"}]}]}]};
  const mascotEyeApertures = {"left":"M264 198 C262 179 275 161 291 161 C310 159 328 180 329 200 C332 218 319 227 299 227 C280 227 264 217 264 198 Z","right":"M461 198 C463 179 450 161 434 161 C415 159 397 180 396 200 C393 218 406 227 426 227 C445 227 461 217 461 198 Z"};
  const mascotPrivacyTargets = {"foreleg-left":"M267 440 C237 417 220 380 224 338 C227 301 247 269 263 232 C274 203 296 180 319 195 C342 204 347 229 335 248 C329 262 316 272 302 276 C287 312 283 355 286 389 C287 415 281 431 267 440 Z","foreleg-right":"M458 440 C488 417 505 380 501 338 C498 301 478 269 462 232 C451 203 429 180 406 195 C383 204 378 229 390 248 C396 262 409 272 423 276 C438 312 442 355 439 389 C438 415 444 431 458 440 Z","forefoot-left":"M273 226 C277 203 296 190 315 199 C336 208 343 227 330 246 C320 259 304 270 290 260 C278 253 268 240 273 226 Z","forefoot-right":"M452 226 C448 203 429 190 410 199 C389 208 382 227 395 246 C405 259 421 270 435 260 C447 253 457 240 452 226 Z","moving-toe-312":"M285 218 C294 205 308 203 317 210 L316 213 C305 207 294 210 288 220 Z","moving-toe-333":"M301 230 C308 219 322 217 333 224 L332 227 C321 222 312 225 304 233 Z","moving-toe-400":"M440 218 C431 205 417 203 408 210 L409 213 C420 207 431 210 437 220 Z","moving-toe-422":"M424 230 C417 219 403 217 392 224 L393 227 C404 222 413 225 421 233 Z"};
  const mascotShadowGradients = {"armpit-shade-left":{"x1":272,"y1":430,"x2":264,"y2":479,"stops":[{"offset":0,"color":"#EAC9A9","opacity":0.65},{"offset":1,"color":"#EAC9A9","opacity":0}]},"armpit-shade-right":{"x1":453,"y1":430,"x2":461,"y2":479,"stops":[{"offset":0,"color":"#EAC9A9","opacity":0.65},{"offset":1,"color":"#EAC9A9","opacity":0}]},"thigh-shade-left":{"x1":260,"y1":520,"x2":296,"y2":660,"stops":[{"offset":0,"color":"#EAC9A9","opacity":0.55},{"offset":1,"color":"#EAC9A9","opacity":0.22}]},"thigh-shade-right":{"x1":470,"y1":520,"x2":434,"y2":660,"stops":[{"offset":0,"color":"#EAC9A9","opacity":0.55},{"offset":1,"color":"#EAC9A9","opacity":0.22}]},"face-shade-left":{"x1":307,"y1":233,"x2":346,"y2":238,"stops":[{"offset":0,"color":"#E8C8AB","opacity":0.45},{"offset":1,"color":"#E8C8AB","opacity":0.12}]},"face-shade-right":{"x1":418,"y1":233,"x2":379,"y2":238,"stops":[{"offset":0,"color":"#E8C8AB","opacity":0.45},{"offset":1,"color":"#E8C8AB","opacity":0.12}]}};
  function draw(p) {
    const surprise = errorAmount;
    if (surprise > 0) p = { ...p, x: p.x * (1-surprise), y: p.y * (1-surprise), blink: mix(p.blink, 1, surprise), cover: p.cover * (1-surprise) };
    // Keep the expression bright through the main wave; the underlying idle rig
    // may otherwise land on a blink exactly at the greeting's hero frame.
    if (waveAmount > 0.02) p = { ...p, blink: mix(p.blink, 1, smoothstep(waveAmount) * 0.92) };
    const width = canvas.width, height = canvas.height;
    context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, width, height);
    const scale = Math.min(width / 220, height / 184);
    context.setTransform(scale, 0, 0, scale, (width - 220 * scale) / 2, (height - 184 * scale) / 2);
    context.translate(110, 175); context.scale(0.265, 0.265); context.translate(-290, -685);
    const greetingElapsed = greetingStarted < 0 ? 0 : Math.max(0, clock - greetingStarted);
    const greetingBounce = target.reducedMotion ? 0 : Math.sin(clamp(greetingElapsed / 0.9, 0, 1) * Math.PI) * waveAmount;
    context.translate(365, 680);
    context.rotate(-0.018 * greetingBounce);
    context.translate(0, -5 * greetingBounce);
    context.translate(-365, -680);
    // One shared breathing transform keeps the face, scarf, limbs and their shadows joined.
    // The ground anchor leaves the feet planted while the chest and head rise slightly.
    const breath = target.reducedMotion ? 0 : Math.sin(clock * Math.PI * 2 / 4.8) * 0.008;
    context.translate(365, 680);context.scale(1 + breath * 0.38, 1 + breath);context.translate(-365, -680);
    const headX = p.x * 2.4, headY = p.y * 1.8 + p.cover * 26;
    // A short joint chain follows the curved tail from the hip to the tip.
    // Each joint bends later than the previous one; the attachment never moves.
    function moveTail(definition) {
      if (target.reducedMotion) return definition;
      const phase = clock * Math.PI * 2 / 4.9;
      const joints = [
        { x: 267, y: 620, s: 0.08, reach: 0.28, angle: Math.sin(phase) * 0.035 },
        { x: 105, y: 555, s: 0.40, reach: 0.24, angle: Math.sin(phase - 0.7) * 0.065 },
        { x: 95, y: 425, s: 0.72, reach: 0.22, angle: Math.sin(phase - 1.35) * 0.09 },
      ];
      const rotate = (x,y,joint,angle) => ({ x: joint.x+(x-joint.x)*Math.cos(angle)-(y-joint.y)*Math.sin(angle), y: joint.y+(x-joint.x)*Math.sin(angle)+(y-joint.y)*Math.cos(angle) });
      const spine = [{x:267,y:620,s:0},{x:175,y:615,s:.23},{x:95,y:550,s:.46},{x:85,y:445,s:.72},{x:145,y:365,s:.92},{x:210,y:370,s:1}];
      return definition.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, a, b) => {
        const originalX=Number(a), originalY=Number(b);
        // The broad overlap hidden behind the haunch remains exactly attached.
        if (originalX >= 240 && originalY >= 565) return a+' '+b;
        let nearest=Infinity, progress=0;
        for(let i=1;i<spine.length;i++){
          const p=spine[i-1],q=spine[i],dx=q.x-p.x,dy=q.y-p.y;
          const t=clamp(((originalX-p.x)*dx+(originalY-p.y)*dy)/(dx*dx+dy*dy),0,1);
          const distance=(originalX-p.x-t*dx)**2+(originalY-p.y-t*dy)**2;
          if(distance<nearest){nearest=distance;progress=mix(p.s,q.s,t);}
        }
        let point={x:originalX,y:originalY};
        const pivots=joints.map(joint=>({...joint}));
        for(let i=0;i<joints.length;i++){
          const joint=joints[i],pivot=pivots[i];
          const weight=clamp((progress-joint.s)/joint.reach,0,1);
          point=rotate(point.x,point.y,pivot,joint.angle*weight*weight*(3-2*weight));
          for(let j=i+1;j<pivots.length;j++)Object.assign(pivots[j],rotate(pivots[j].x,pivots[j].y,pivot,joint.angle));
        }
        return point.x+' '+point.y;
      });
    }
    function movePaw(definition, side, id) {
      if (side === 1 && waveAmount > 0 && mascotPrivacyTargets[id]) {
        const values = mascotPrivacyTargets[id].match(/-?\d+(?:\.\d+)?/g).map(Number);
        const swing = greetingWave(greetingElapsed);
        let coordinate = 0;
        return definition.replace(/-?\d+(?:\.\d+)?/g, value => {
          const index=coordinate++, isY=index%2, pair=index-isY;
          const weight=clamp((440-values[pair+1])/200,0,1);
          const x=values[pair]+115*weight, y=values[pair+1]-25*weight;
          const rotation=swing*weight;
          const dx=x-537,dy=y-207;
          const raised=isY ? 207+dx*Math.sin(rotation)+dy*Math.cos(rotation) : 537+dx*Math.cos(rotation)-dy*Math.sin(rotation);
          return mix(Number(value),raised,waveAmount);
        });
      }
      if (p.cover < 0.0001) return definition;
      const target = mascotPrivacyTargets[id];
      if (!target) return definition;
      const values = target.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const original = definition.match(/-?\d+(?:\.\d+)?/g).map(Number);
      let coordinate = 0;
      return definition.replace(/-?\d+(?:\.\d+)?/g, value => {
        const index = coordinate++, y = index % 2;
        const targetValue = values[index];
        const handWeight = clamp((440 - values[y ? index : index + 1]) / 220, 0, 1);
        const follow = (y ? p.y * 1.8 : headX) * handWeight * p.cover;
        const arc = y ? 0 : side * Math.sin(Math.PI * p.cover) * 48 * clamp((original[index+1]-410)/260,0,1);
        return mix(Number(value), targetValue, p.cover) + follow + arc;
      });
    }
    function drawGreetingArm(amount) {
      const swing = greetingWave(greetingElapsed);
      context.save();
      context.globalAlpha = amount;
      context.translate(452, 402); context.rotate(swing); context.translate(-452, -402);
      path('greeting-arm', 'M423 404 C452 374 479 329 500 284 C516 248 525 211 540 185 C553 165 580 164 596 181 C611 198 604 222 586 242 C566 269 553 305 541 340 C528 380 505 415 477 435 C456 449 434 435 423 404 Z', '#FCEDE0');
      context.restore();
    }
    function render(node, limbSide = 0) {
      const id = node.id;
      if (id === 'paw-front-left') limbSide = -1;
      if (id === 'paw-front-right') limbSide = 1;
      if (id === 'head' && waveAmount > 0.02) drawGreetingArm(smoothstep(waveAmount));
      context.save();
      if (id === 'paw-front-right' && waveAmount > 0.02) context.globalAlpha = 0;
      if (id === 'tail') {
        context.translate(273, 620);
        context.rotate(-0.025);
        context.translate(-267, -620);
      }
      if (['brows','eyes','nose','mouth','whiskers-left','whiskers-right'].includes(id)) {
        context.translate(366, 20 * surprise);
        context.scale(1 - 0.035 * surprise, 1);
        context.translate(-366, 0);
      }
      if (id === 'brows') context.translate(0, -7 * surprise);
      if (id === 'brows' && waveAmount > 0.02) context.translate(0, -5 * waveAmount);
      if (id === 'mouth' && surprise > 0) {
        context.save(); context.globalAlpha *= surprise;
        oval(366, 262, 10, 11, '#A84F3C');
        oval(366, 268, 8, 4, '#F4A487');
        context.restore(); context.globalAlpha *= 1-surprise;
      }
      if (id === 'mouth' && waveAmount > 0.02) {
        context.save(); context.globalAlpha *= smoothstep(waveAmount);
        const smile = 'M365 237 L368 237 L369 249 C378 260 390 260 397 260 C396 285 384 302 366 306 C348 302 336 285 335 260 C342 260 354 260 365 249 Z';
        shapes['greeting-mouth-unified'] ||= new Path2D(smile);
        context.fillStyle = '#6F2E2A'; context.fill(shapes['greeting-mouth-unified']);
        context.save(); context.clip(shapes['greeting-mouth-unified']); oval(366, 292, 20, 13, '#F58F83'); context.restore();
        context.restore();
      }
      if (id === 'privacy-body-shadows') {
        context.globalAlpha *= clamp((p.cover - 0.2) / 0.8, 0, 1);
        if (shapes['body-neck']) context.clip(shapes['body-neck']);
      }
      if (id === 'privacy-face-shadows') {
        context.globalAlpha *= clamp((p.cover - 0.8) / 0.2, 0, 1);
        if (shapes['head-shape']) context.clip(shapes['head-shape']);
      }
      if (id === 'eyes') context.globalAlpha *= 1 - clamp((p.cover - 0.3) / 0.4, 0, 1);
      if (['foreleg-left-shadow','body-left-shade','hind-left-shadow','hind-right-shadow'].includes(id)) context.globalAlpha *= 1 - p.cover;
      if (id.startsWith('moving-toe-') || id.startsWith('palm-definition-')) {
        const foot = limbSide < 0 ? 'forefoot-left' : 'forefoot-right';
        const arm = limbSide < 0 ? 'foreleg-left' : 'foreleg-right';
        if (shapes[foot] && shapes[arm]) {
          const silhouette = new Path2D(shapes[arm]);silhouette.addPath(shapes[foot]);context.clip(silhouette);
        }
      }
      if (id.startsWith('palm-definition-')) {
        context.globalAlpha *= clamp((p.cover - 0.65) / 0.35, 0, 1);
        const left = limbSide < 0, center = left ? 303 : 422;
        const restX = left ? 322 : 415;
        const arc = (left ? -1 : 1) * Math.sin(Math.PI*p.cover) * 48;
        context.translate((restX-center)*(1-p.cover)+arc+headX*p.cover,442*(1-p.cover)+p.y*1.8*p.cover);
        context.translate(center,232);context.scale(0.6+0.4*p.cover,0.4+0.6*p.cover);context.translate(-center,-232);
      }
      if (id === 'head') context.translate(headX, headY);
      if (id === 'eye-left' || id === 'eye-right') {
        context.translate(0, 195);context.scale(1, p.blink);context.translate(0, -195);
      }
      if (id === 'pupil-left' || id === 'pupil-right') {
        const side = id === 'pupil-left' ? 'left' : 'right';
        shapes['eye-clip-' + side] ||= new Path2D(mascotEyeApertures[side]);
        // Clip in the stationary eye's coordinates before translating the pupil.
        // The parent eye transform already includes the current blink and head pose.
        context.clip(shapes['eye-clip-' + side]);
        const center = side === 'left' ? 307 : 418;
        context.translate(mix(clamp(p.pupilX * 1.6, -8, 8), side === 'left' ? 2 : -2, surprise), mix(clamp(p.pupilY * 1.4, -3, 5), 29, surprise));
        context.translate(center,196); context.scale(1 - surprise * 0.14, 1 - surprise * 0.14); context.translate(-center,-196);
      }
      if (id === 'scarf-back') {
        context.translate(277, 336);context.rotate(target.reducedMotion ? 0 : Math.sin(clock * Math.PI * 2 / 4.8 - 0.6) * 0.012);context.translate(-277, -336);
      }
      if (node.tag === 'path') {
        if (id.startsWith('ear-')) {
          shapes[id] = new Path2D(node.d);
        } else if (limbSide) {
          const definition = id.startsWith('palm-definition-') ? node.d : movePaw(node.d, limbSide, id);
          shapes[id] = new Path2D(definition);
        } else if (id.startsWith('tail-')) {
          shapes[id] = new Path2D(moveTail(node.d));
        } else if (id === 'body-neck') {
          const definition = node.d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, a, b) => {
            const x = Number(a), y = Number(b), weight = clamp((660 - y) / 350, 0, 1);
            return (x + headX * weight * weight * 0.45) + ' ' + (660 + (y - 660) * (1 - p.cover * 0.006));
          });
          shapes[id] = new Path2D(definition);
        } else shapes[id] ||= new Path2D(node.d);
        const gradientId = /^url\(#([^)]+)\)$/.exec(node.fill)?.[1];
        const gradientSpec = mascotShadowGradients[gradientId];
        if (gradientSpec) {
          const gradient = context.createLinearGradient(gradientSpec.x1, gradientSpec.y1, gradientSpec.x2, gradientSpec.y2);
          for (const stop of gradientSpec.stops) {
            const rgb = parseInt(stop.color.slice(1), 16);
            gradient.addColorStop(stop.offset, 'rgba(' + (rgb >> 16) + ',' + (rgb >> 8 & 255) + ',' + (rgb & 255) + ',' + stop.opacity + ')');
          }
          context.fillStyle = gradient;
        } else context.fillStyle = id.startsWith('moving-toe-') ? 'rgb(' + mix(229,211,p.cover) + ',' + mix(161,160,p.cover) + ',' + mix(127,121,p.cover) + ')' : node.fill;
        if (id === 'mouth' && waveAmount > 0.02) context.globalAlpha = 0;
        context.fill(shapes[id]);
      }
      const lifted = id === 'character' && (p.cover > 0.001 || waveAmount > 0.001);
      const children = node.children;
      for (const child of children) {
        if (!lifted || (child.id !== 'paw-front-left' && child.id !== 'paw-front-right')) render(child, limbSide);
      }
      if (lifted) for (const child of node.children) {
        if (child.id === 'paw-front-left' || child.id === 'paw-front-right') render(child, limbSide);
      }
      context.restore();
    }
    render(mascotArtwork);
    if (waveAmount > 0.02) {
      const amount = smoothstep(waveAmount), swing = greetingWave(greetingElapsed);
      context.save(); context.globalAlpha = amount;
      context.translate(452, 402); context.rotate(swing); context.translate(-452, -402);
      if (shapes['greeting-arm']) context.clip(shapes['greeting-arm']);
      context.translate(570, 200); context.rotate(0.27); context.translate(-570, -200);
      oval(570, 210, 15, 18, '#F5A18A');
      oval(553, 184, 7, 8.5, '#F5A18A');
      oval(569, 178, 7, 8.5, '#F5A18A');
      oval(585, 184, 7, 8.5, '#F5A18A');
      context.restore();
    }
    if (waveAmount > 0.03) {
      const rays = smoothstep((greetingElapsed - 0.62) / 0.2) * (1 - smoothstep((greetingElapsed - 1.9) / 0.35));
      if (rays > 0.01) {
        context.save(); context.globalAlpha = rays; context.strokeStyle = '#D4DE38';
        context.lineWidth = 14; context.lineCap = 'round';
        const pulse = 1 + Math.sin(greetingElapsed * Math.PI * 4) * 0.04;
        context.translate(555, 130); context.scale(pulse, pulse);
        for (const [x1,y1,x2,y2] of [[0,5,5,-30],[18,8,38,-22],[32,20,65,4]]) {
          context.beginPath(); context.moveTo(x1,y1); context.lineTo(x2,y2); context.stroke();
        }
        context.restore();
      }
    }
    if (surprise > 0) {
      context.save(); context.globalAlpha *= surprise;
      context.translate(headX,headY);
      context.translate(542,111); context.rotate(0.18);
      path('error-mark','M-10 -42 Q-10 -51 0 -51 Q10 -51 10 -42 L8 -8 Q8 -2 0 -2 Q-8 -2 -8 -8 Z','#F2C94C');
      oval(0, 14, 9, 9, '#F2C94C');
      context.restore();
    }
  }
  function emit(type, p) {
    notify({ type, mode: target.lookingAway ? 'privacy' : target.watching ? 'watching' : 'idle',
      handsUp: inputs?.isHandsUp.value ?? false, checking: inputs?.isChecking.value ?? false,
      look: inputs?.numLook.value ?? 50, cover: p?.cover ?? 0, pupilX: p?.pupilX ?? 0, errorAmount, earDrop, waveAmount });
  }
  function advance(seconds) { machine.advanceAndApply(seconds);artboard.advance(seconds); }
  function tick(timestamp) {
    frame = null;
    if (disposed || hidden || !loaded) return;
    const delta = lastTime ? clamp((timestamp - lastTime) / 1000, 0, 0.05) : 1 / 60;
    lastTime = timestamp;clock += delta;
    if (greetingStarted >= 0) {
      const elapsed=clock-greetingStarted;
      waveAmount=smoothstep((elapsed-0.12)/0.48)*(1-smoothstep((elapsed-2.25)/0.5));
      if (target.watching || target.lookingAway || target.errorSignal || elapsed > 2.85) greetingStarted=-1;
    } else waveAmount *= Math.exp(-delta*15);
    const errored = !!target.errorSignal;
    errorAmount = mix(errorAmount, errored ? 1 : 0, 1-Math.exp(-delta*12));
    if (!errored && errorAmount < 0.001) { errorAmount = 0; }
    const goal = target.watching && !target.lookingAway ? target.progress * 100 : 50;
    smoothLook += (goal - smoothLook) * (1 - Math.exp(-delta * 16));
    if (Math.abs(goal - smoothLook) < 0.1) smoothLook = goal;
    inputs.numLook.value = smoothLook;
    advance(delta);
    const current = pose();draw(current);emit('state', current);
    frame = engine.requestAnimationFrame(tick);
  }
  function apply() {
    if (!loaded || disposed) return;
    inputs.isHandsUp.value = target.lookingAway && !target.errorSignal;
    inputs.isChecking.value = target.watching && !target.lookingAway && !target.errorSignal;
    if (target.reducedMotion) {
      waveAmount = 0;
      errorAmount = target.errorSignal ? 1 : 0;
      if (frame != null) engine.cancelAnimationFrame(frame);
      frame = null;lastTime = 0;
      smoothLook = target.watching && !target.lookingAway ? target.progress * 100 : 50;
      inputs.numLook.value = smoothLook;
      for (let i = 0; i < 90; i++) advance(1 / 60);
      const current = pose();draw(current);emit('state', current);
    } else if (!hidden && frame == null) { lastTime = 0;frame = engine.requestAnimationFrame(tick); }
  }
  function resize() {
    if (disposed) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (loaded) draw(pose());
  }
  async function load() {
    try {
      engine = await runtime.RuntimeLoader.awaitInstance();
      if (disposed) return;
      const buffer = source.buffer || await fetch(source.src, { signal: abort.signal }).then(response => {
        if (!response.ok) throw new Error('Could not load motion template');
        return response.arrayBuffer();
      });
      if (disposed) return;
      file = await engine.load(new Uint8Array(buffer), undefined, false);
      if (disposed) { file.unref();file = null;return; }
      artboard = file.defaultArtboard();
      machine = new engine.StateMachineInstance(artboard.stateMachineByName('Login Machine'), artboard);
      inputs = {};
      for (let i = 0; i < machine.inputCount(); i++) {
        const input = machine.input(i);
        if (input.name === 'numLook') inputs[input.name] = input.asNumber();
        else if (input.name === 'isHandsUp' || input.name === 'isChecking') inputs[input.name] = input.asBool();
      }
      if (!inputs.numLook || !inputs.isHandsUp || !inputs.isChecking) throw new Error('Motion template inputs missing');
      nodes = Object.fromEntries(Object.entries({ head: 'Ctrl_look', hand: 'Ctrl_hand_left', pupil: 'Ctrl_pupils', left: 'Ctrl_eye_left', right: 'Ctrl_eye_right', lidTop: 'Ctrl_eyelid_top_Left', lidBottom: 'Ctrl_eyelid_bottom_left' }).map(([key, name]) => [key, artboard.node(name)]));
      if (Object.values(nodes).some(node => !node)) throw new Error('Motion template controls missing');
      loaded = true;resize();apply();emit('ready', pose());
    } catch (error) { if (!disposed) emit('error'); }
  }
  load();
  return {
    update(next) { const sequence=Number(next.greetingSignal)||0;if (next.greeting && (!greetingPlayed || sequence!==greetingSequence)) { greetingPlayed=true;greetingSequence=sequence;if (!next.reducedMotion) greetingStarted=clock; } target = { errorSignal: next.errorSignal || 0, lookingAway: !!next.lookingAway, watching: !!next.watching, progress: clamp(Number(next.progress) || 0, 0, 1), reducedMotion: !!next.reducedMotion };apply(); },
    resize,
    setHidden(value) { hidden = !!value;if (hidden && frame != null) { engine.cancelAnimationFrame(frame);frame = null;lastTime = 0; } else if (!hidden) apply(); },
    cleanup() { disposed = true;abort.abort();if (frame != null) engine.cancelAnimationFrame(frame);machine?.delete();artboard?.delete();file?.unref(); },
  };
}
