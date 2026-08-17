(function () {
  "use strict";

  var links = Array.prototype.slice.call(document.querySelectorAll("a.js-video-lightbox[data-video-src]"));
  if (!links.length) {
    return;
  }

  var overlay = document.createElement("div");
  overlay.className = "video-lightbox";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "video-lightbox-title");

  var dialog = document.createElement("div");
  dialog.className = "video-lightbox-dialog";
  dialog.tabIndex = -1;

  var title = document.createElement("h2");
  title.className = "video-lightbox-title";
  title.id = "video-lightbox-title";

  var video = document.createElement("video");
  video.className = "video-lightbox-video";
  video.controls = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "none";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("preload", "none");
  video.setAttribute("aria-label", "Project video");

  var closeButton = document.createElement("button");
  closeButton.className = "video-lightbox-close";
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.setAttribute("aria-label", "Close video viewer");

  dialog.appendChild(title);
  dialog.appendChild(video);
  overlay.appendChild(dialog);
  overlay.appendChild(closeButton);
  document.body.appendChild(overlay);

  var returnFocus = null;

  function openViewer(link) {
    if (!overlay.hidden) {
      return;
    }
    returnFocus = link;
    var videoTitle = link.getAttribute("data-video-title") || "Project video";
    title.textContent = videoTitle;
    video.setAttribute("aria-label", videoTitle + " video");
    video.poster = new URL(link.getAttribute("data-video-poster"), window.location.href).href;
    video.src = new URL(link.getAttribute("data-video-src"), window.location.href).href;
    overlay.hidden = false;
    document.body.classList.add("lightbox-open");
    video.load();
    var playback = video.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(function () {
        if (!overlay.hidden) {
          video.focus();
        }
      });
    }
    dialog.focus();
  }

  function closeViewer() {
    if (overlay.hidden) {
      return;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
    overlay.hidden = true;
    document.body.classList.remove("lightbox-open");
    if (returnFocus) {
      returnFocus.focus();
    }
    returnFocus = null;
  }

  links.forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openViewer(link);
    });
  });

  closeButton.addEventListener("click", closeViewer);

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) {
      closeViewer();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (overlay.hidden) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeViewer();
    } else if (event.key === "Tab") {
      if (event.shiftKey && (document.activeElement === video || document.activeElement === dialog)) {
        event.preventDefault();
        closeButton.focus();
      } else if (!event.shiftKey && document.activeElement === closeButton) {
        event.preventDefault();
        video.focus();
      }
    }
  });

  window.addEventListener("pagehide", function () {
    if (!overlay.hidden) {
      closeViewer();
    }
  });

  window.__C6B_VIDEO_LIGHTBOX__ = {
    close: closeViewer
  };
}());
