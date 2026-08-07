(function () {
  "use strict";

  var links = Array.prototype.slice.call(document.querySelectorAll("a.js-lightbox[href]"));
  if (!links.length) {
    return;
  }

  var overlay = document.createElement("div");
  overlay.className = "image-lightbox";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Enlarged gallery image");

  var closeButton = document.createElement("button");
  closeButton.className = "image-lightbox-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close image viewer");
  closeButton.textContent = "\u00d7";

  var image = document.createElement("img");
  image.className = "image-lightbox-image";
  image.alt = "";

  overlay.appendChild(closeButton);
  overlay.appendChild(image);
  document.body.appendChild(overlay);

  var returnFocus = null;

  function openViewer(link) {
    var thumbnail = link.querySelector("img");
    returnFocus = link;
    image.src = link.href;
    image.alt = thumbnail && thumbnail.alt ? thumbnail.alt : "Enlarged gallery image";
    overlay.hidden = false;
    document.body.classList.add("lightbox-open");
    closeButton.focus();
  }

  function closeViewer() {
    if (overlay.hidden) {
      return;
    }
    overlay.hidden = true;
    document.body.classList.remove("lightbox-open");
    image.removeAttribute("src");
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
      event.preventDefault();
      closeButton.focus();
    }
  });
}());
