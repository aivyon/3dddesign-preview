(function () {
  "use strict";

  var AUTOPLAY_INTERVAL = 5000;
  var TRANSITION_DURATION = 320;
  var links = Array.prototype.slice.call(document.querySelectorAll("a.js-lightbox[href]"));
  if (!links.length) {
    return;
  }

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var presentationSources = window.C6B_PRESENTATION_SOURCES || {};
  var groups = {};

  links.forEach(function (link) {
    var groupId = link.getAttribute("data-lightbox-group") || "gallery";
    var frame = link.closest(".album-frame");
    var thumbnail = link.querySelector("img");
    var slot = link.closest(".album-slot");
    var title = frame && frame.getAttribute("data-category-title") || "Project";
    var sequence = slot && Number(slot.getAttribute("data-media-sequence")) || 0;
    var originalUrl = new URL(link.href, window.location.href);
    var sourceRecord = presentationSources[originalUrl.pathname] || {
      presentationPath: originalUrl.pathname,
      originalWidth: 0,
      originalHeight: 0,
      presentationWidth: 0,
      presentationHeight: 0,
      sourceKind: "native"
    };
    var item = {
      link: link,
      originalSrc: originalUrl.href,
      presentationSrc: new URL(sourceRecord.presentationPath, window.location.origin).href,
      originalWidth: sourceRecord.originalWidth,
      originalHeight: sourceRecord.originalHeight,
      presentationWidth: sourceRecord.presentationWidth,
      presentationHeight: sourceRecord.presentationHeight,
      sourceKind: sourceRecord.sourceKind,
      title: title,
      sequence: sequence,
      alt: thumbnail && thumbnail.alt ? thumbnail.alt : title
    };

    if (!groups[groupId]) {
      groups[groupId] = [];
    }
    groups[groupId].push(item);
  });

  Object.keys(groups).forEach(function (groupId) {
    groups[groupId].sort(function (a, b) {
      return a.sequence - b.sequence;
    });
  });

  var overlay = document.createElement("div");
  overlay.className = "image-lightbox";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "image-lightbox-title");
  overlay.setAttribute("aria-describedby", "image-lightbox-status");

  var dialog = document.createElement("div");
  dialog.className = "image-lightbox-dialog";
  dialog.tabIndex = -1;
  dialog.setAttribute("data-view-mode", "fit");

  var header = document.createElement("div");
  header.className = "image-lightbox-header";

  var title = document.createElement("h2");
  title.className = "image-lightbox-title";
  title.id = "image-lightbox-title";

  var meta = document.createElement("div");
  meta.className = "image-lightbox-meta";

  var counter = document.createElement("span");
  counter.className = "image-lightbox-counter";
  counter.setAttribute("aria-live", "polite");

  var status = document.createElement("span");
  status.className = "image-lightbox-status";
  status.id = "image-lightbox-status";
  status.setAttribute("aria-live", "polite");

  meta.appendChild(counter);
  meta.appendChild(status);
  header.appendChild(title);
  header.appendChild(meta);

  var stage = document.createElement("div");
  stage.className = "image-lightbox-stage";
  stage.setAttribute("aria-label", "Project image");

  function makeButton(className, label, accessibleLabel) {
    var button = document.createElement("button");
    button.className = "image-lightbox-control " + className;
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", accessibleLabel || label);
    return button;
  }

  var previousButton = makeButton("image-lightbox-previous", "‹", "Previous image");
  var nextButton = makeButton("image-lightbox-next", "›", "Next image");
  previousButton.setAttribute("title", "Previous image");
  nextButton.setAttribute("title", "Next image");
  stage.appendChild(previousButton);
  stage.appendChild(nextButton);

  var controls = document.createElement("div");
  controls.className = "image-lightbox-controls";
  controls.setAttribute("aria-label", "Slideshow controls");

  var playButton = makeButton("image-lightbox-play", "Pause", "Pause autoplay");
  var fitButton = makeButton("image-lightbox-fit", "Fit to screen", "Fit image to screen");
  var actualButton = makeButton("image-lightbox-actual", "Original pixels", "View untouched source at original pixel size");
  fitButton.setAttribute("aria-pressed", "true");
  actualButton.setAttribute("aria-pressed", "false");

  controls.appendChild(playButton);
  controls.appendChild(fitButton);
  controls.appendChild(actualButton);

  var closeButton = document.createElement("button");
  closeButton.className = "image-lightbox-close";
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.setAttribute("aria-label", "Close project viewer");

  dialog.appendChild(header);
  dialog.appendChild(stage);
  dialog.appendChild(controls);
  overlay.appendChild(dialog);
  overlay.appendChild(closeButton);
  document.body.appendChild(overlay);

  var currentGroup = [];
  var currentGroupId = "";
  var currentIndex = 0;
  var currentImage = null;
  var returnFocus = null;
  var autoplayWanted = false;
  var autoplayTimer = null;
  var touchPaused = false;
  var touchStart = null;
  var activePointers = 0;
  var renderSerial = 0;

  function currentItem() {
    return currentGroup[currentIndex];
  }

  function pauseReason() {
    if (!autoplayWanted) {
      return prefersReducedMotion.matches ? "for reduced motion" : "by user";
    }
    if (document.hidden) {
      return "while tab is hidden";
    }
    if (touchPaused) {
      return "during touch";
    }
    return "";
  }

  function clearAutoplayTimer() {
    if (autoplayTimer !== null) {
      window.clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function updateAutoplayState() {
    var reason = pauseReason();
    var running = autoplayWanted && !reason && !overlay.hidden;
    status.textContent = running ? "Playing" : "Paused" + (reason ? " " + reason : "");
    status.setAttribute("data-running", String(running));
    overlay.setAttribute("data-autoplay-state", running ? "running" : "paused");
    playButton.textContent = autoplayWanted ? "Pause" : "Play";
    playButton.setAttribute("aria-label", autoplayWanted ? "Pause autoplay" : "Start autoplay");
    playButton.setAttribute("aria-pressed", String(autoplayWanted));
    return running;
  }

  function scheduleAutoplay(reset) {
    if (reset) {
      clearAutoplayTimer();
    }
    if (!updateAutoplayState() || autoplayTimer !== null || currentGroup.length < 2) {
      return;
    }
    autoplayTimer = window.setTimeout(function () {
      autoplayTimer = null;
      showSlide((currentIndex + 1) % currentGroup.length, false);
    }, AUTOPLAY_INTERVAL);
  }

  function sourceFor(item, actual) {
    return actual ? item.originalSrc : item.presentationSrc;
  }

  function dimensionsFor(item, actual) {
    return {
      width: actual ? item.originalWidth : item.presentationWidth,
      height: actual ? item.originalHeight : item.presentationHeight
    };
  }

  function sizeImageToStage(target, item, actual) {
    if (!target || !item) {
      return;
    }
    var dimensions = dimensionsFor(item, actual);
    var width = dimensions.width || target.naturalWidth;
    var height = dimensions.height || target.naturalHeight;
    if (!width || !height) {
      return;
    }

    var scale = 1;
    if (!actual) {
      var availableWidth = Math.max(1, stage.clientWidth);
      var availableHeight = Math.max(1, stage.clientHeight);
      var maximumScale = item.sourceKind === "lanczos-2x" ? 1 : 2;
      scale = Math.min(availableWidth / width, availableHeight / height, maximumScale);
    }
    target.style.width = Math.round(width * scale * 100) / 100 + "px";
    target.style.height = Math.round(height * scale * 100) / 100 + "px";
    target.setAttribute("data-visible-width", String(Math.round(width * scale * 100) / 100));
    target.setAttribute("data-visible-height", String(Math.round(height * scale * 100) / 100));
  }

  function updateSourceMetadata(item, actual) {
    var dimensions = dimensionsFor(item, actual);
    overlay.setAttribute("data-original-src", item.originalSrc);
    overlay.setAttribute("data-display-src", sourceFor(item, actual));
    overlay.setAttribute("data-source-kind", actual ? "original" : item.sourceKind);
    overlay.setAttribute("data-source-width", String(dimensions.width));
    overlay.setAttribute("data-source-height", String(dimensions.height));
  }

  function installImage(item, animate) {
    var actual = dialog.getAttribute("data-view-mode") === "actual";
    var source = sourceFor(item, actual);
    var oldImage = currentImage;
    var nextImage = document.createElement("img");
    var serial = ++renderSerial;
    nextImage.className = "image-lightbox-image image-lightbox-image-current";
    nextImage.alt = item.alt + ", image " + (currentIndex + 1) + " of " + currentGroup.length;
    nextImage.draggable = false;
    nextImage.setAttribute("data-slide-index", String(currentIndex));
    nextImage.setAttribute("data-source-kind", actual ? "original" : item.sourceKind);
    if (oldImage && animate && !prefersReducedMotion.matches) {
      nextImage.classList.add("image-lightbox-image-incoming");
    }
    if (oldImage) {
      oldImage.classList.remove("image-lightbox-image-current");
    }
    currentImage = nextImage;
    stage.appendChild(nextImage);
    updateSourceMetadata(item, actual);

    nextImage.addEventListener("load", function () {
      if (serial !== renderSerial || overlay.hidden) {
        return;
      }
      nextImage.setAttribute("data-natural-width", String(nextImage.naturalWidth));
      nextImage.setAttribute("data-natural-height", String(nextImage.naturalHeight));
      sizeImageToStage(nextImage, item, actual);
      if (oldImage && animate && !prefersReducedMotion.matches) {
        window.requestAnimationFrame(function () {
          nextImage.classList.add("is-visible");
          oldImage.classList.add("is-outgoing");
        });
        window.setTimeout(function () {
          if (oldImage.isConnected) {
            oldImage.remove();
          }
          nextImage.classList.remove("image-lightbox-image-incoming", "is-visible");
        }, TRANSITION_DURATION + 40);
      } else {
        if (oldImage && oldImage.isConnected) {
          oldImage.remove();
        }
      }
    });

    nextImage.addEventListener("error", function () {
      if (!actual && source !== item.originalSrc) {
        item.presentationSrc = item.originalSrc;
        item.presentationWidth = item.originalWidth;
        item.presentationHeight = item.originalHeight;
        item.sourceKind = "native-fallback";
        installImage(item, false);
      }
    });
    nextImage.src = source;
  }

  function preloadNeighbors() {
    if (currentGroup.length < 2) {
      return;
    }
    [
      (currentIndex + 1) % currentGroup.length,
      (currentIndex - 1 + currentGroup.length) % currentGroup.length
    ].forEach(function (index) {
      var preload = new Image();
      preload.src = currentGroup[index].presentationSrc;
    });
  }

  function setViewMode(mode, reload) {
    var actual = mode === "actual";
    dialog.setAttribute("data-view-mode", actual ? "actual" : "fit");
    fitButton.setAttribute("aria-pressed", String(!actual));
    actualButton.setAttribute("aria-pressed", String(actual));
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
    if (reload && currentGroup.length) {
      installImage(currentItem(), false);
    }
  }

  function showSlide(index, manual) {
    var hadImage = Boolean(currentImage);
    currentIndex = (index + currentGroup.length) % currentGroup.length;
    var item = currentItem();
    title.textContent = item.title;
    counter.textContent = (currentIndex + 1) + " / " + currentGroup.length;
    overlay.setAttribute("data-slide-index", String(currentIndex));
    overlay.setAttribute("data-group-id", currentGroupId);
    setViewMode("fit", false);
    installImage(item, hadImage);
    preloadNeighbors();
    scheduleAutoplay(Boolean(manual));
  }

  function openViewer(link) {
    currentGroupId = link.getAttribute("data-lightbox-group") || "gallery";
    currentGroup = groups[currentGroupId];
    currentIndex = currentGroup.findIndex(function (item) {
      return item.link === link;
    });
    if (currentIndex < 0) {
      currentIndex = 0;
    }
    returnFocus = link;
    autoplayWanted = !prefersReducedMotion.matches;
    touchPaused = false;
    activePointers = 0;
    overlay.hidden = false;
    document.body.classList.add("lightbox-open");
    showSlide(currentIndex, true);
    dialog.focus();
  }

  function closeViewer() {
    if (overlay.hidden) {
      return;
    }
    clearAutoplayTimer();
    renderSerial += 1;
    overlay.hidden = true;
    document.body.classList.remove("lightbox-open");
    stage.querySelectorAll(".image-lightbox-image").forEach(function (openImage) {
      openImage.remove();
    });
    currentImage = null;
    currentGroup = [];
    currentGroupId = "";
    touchPaused = false;
    activePointers = 0;
    updateAutoplayState();
    if (returnFocus) {
      returnFocus.focus();
    }
    returnFocus = null;
  }

  function navigate(delta, manual) {
    if (!currentGroup.length) {
      return;
    }
    showSlide(currentIndex + delta, manual);
  }

  links.forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openViewer(link);
    });
  });

  previousButton.addEventListener("click", function () {
    navigate(-1, true);
  });

  nextButton.addEventListener("click", function () {
    navigate(1, true);
  });

  playButton.addEventListener("click", function () {
    autoplayWanted = !autoplayWanted;
    scheduleAutoplay(true);
  });

  fitButton.addEventListener("click", function () {
    setViewMode("fit", true);
  });

  actualButton.addEventListener("click", function () {
    setViewMode("actual", true);
  });

  closeButton.addEventListener("click", closeViewer);

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) {
      closeViewer();
    }
  });

  stage.addEventListener("pointerdown", function (event) {
    if (event.pointerType !== "touch") {
      return;
    }
    activePointers += 1;
    touchPaused = true;
    clearAutoplayTimer();
    updateAutoplayState();
    if (activePointers === 1) {
      touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    } else {
      touchStart = null;
    }
  });

  stage.addEventListener("pointerup", function (event) {
    if (event.pointerType !== "touch") {
      return;
    }
    activePointers = Math.max(0, activePointers - 1);
    var swipe = null;
    if (touchStart && touchStart.id === event.pointerId) {
      var deltaX = event.clientX - touchStart.x;
      var deltaY = event.clientY - touchStart.y;
      if (Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
        swipe = deltaX < 0 ? 1 : -1;
      }
    }
    touchStart = null;
    if (!activePointers) {
      touchPaused = false;
      if (swipe !== null) {
        navigate(swipe, true);
      } else {
        scheduleAutoplay(true);
      }
    }
  });

  stage.addEventListener("pointercancel", function () {
    activePointers = 0;
    touchStart = null;
    touchPaused = false;
    scheduleAutoplay(true);
  });

  document.addEventListener("visibilitychange", function () {
    if (overlay.hidden) {
      return;
    }
    clearAutoplayTimer();
    scheduleAutoplay(true);
  });

  function focusableControls() {
    return Array.prototype.slice.call(overlay.querySelectorAll("button:not([disabled]):not([hidden])")).filter(function (button) {
      return button.getClientRects().length > 0;
    });
  }

  document.addEventListener("keydown", function (event) {
    if (overlay.hidden) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeViewer();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigate(-1, true);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      navigate(1, true);
    } else if (event.key === "Tab") {
      var focusable = focusableControls();
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("resize", function () {
    if (!overlay.hidden && currentImage) {
      sizeImageToStage(
        currentImage,
        currentItem(),
        dialog.getAttribute("data-view-mode") === "actual"
      );
    }
  });

  prefersReducedMotion.addEventListener("change", function () {
    if (overlay.hidden) {
      return;
    }
    if (prefersReducedMotion.matches) {
      autoplayWanted = false;
      clearAutoplayTimer();
    }
    scheduleAutoplay(true);
  });

  window.__C6B_LIGHTBOX__ = {
    autoplayInterval: AUTOPLAY_INTERVAL,
    transitionDuration: TRANSITION_DURATION,
    groupSizes: Object.keys(groups).reduce(function (sizes, groupId) {
      sizes[groupId] = groups[groupId].length;
      return sizes;
    }, {})
  };
}());
