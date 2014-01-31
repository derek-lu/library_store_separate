(function($) {
$.fn.horizontalPageContainer = function(method) {
	if (this[0][method]) {
		return this[0][method].apply( this, Array.prototype.slice.call( arguments, 1 ));
	} else if ( typeof method === 'object' || ! method ) {
		return this.each(function() {
			var $this = $(this);

			var selectedIndex = 0;		// The current visible page.

			var ANIMATION_DURATION = .6;		// The duration to flick the content. In seconds.
			var MOVE_THRESHOLD = 10;			// Since touch points can move slightly when initiating a click this is the
												// amount to move before allowing the element to dispatch a click event.
												
			var pageWidth;
			
			var touchStartTransformX;			// The start transformX when the user taps.
			var touchStartX;					// The start x coord when the user taps.
			var interval;						// Interval used for measuring the drag speed.
			var wasContentDragged;				// Flag for whether or not the content was dragged. Takes into account MOVE_THRESHOLD.
			var targetTransformX;				// The target transform X when a user flicks the content.
			var touchDragCoords = [];			// Used to keep track of the touch coordinates when dragging to measure speed.
			var touchstartTarget;				// The element which triggered the touchstart.
			var viewPortWidth;					// The width of the div that holds the horizontal content.
			var navStatus;						// The canvas that will contain the nav circles.
			var navStatusContext;				// The context of the canvas.
			var $pageContainer;
			
			var isDrawNavStatusBackground;
			
			var numPages;
			
			init();
			
			function init() {
				$this[0].addEventListener("touchstart", touchstartHandler);
				$this[0].addEventListener("mousedown", touchstartHandler);
				
				isDrawNavStatusBackground = method.isDrawNavStatusBackground;
	
				viewPortWidth = method.viewPortWidth;
				
				$pageContainer = $this.find(".pages");
				
				// Get a reference to the canvas used to draw the scroll indicator.
				navStatus = $this.find(".navStatus");

				navStatusContext = navStatus[0].getContext("2d");

				_setNumPages(method.numPages || $pageContainer.children().length);

				$pageContainer.on("webkitTransitionEnd", transitionEndHandler);
			}

			function _setNumPages(value) {
				// Need to explicitly set the width otherwise the pages will wrap.
				$pageContainer.css("width", viewPortWidth * value);
				numPages = value;

				if (value > 0)
					drawNavStatus();
			}
			
			function touchstartHandler(e) {
				clearInterval(interval);
				
				wasContentDragged = false;
				
				// Transition in progress.
				if (targetTransformX != undefined && targetTransformX != getTransformX())
					dispatchTransitionEndEvent();
				
				// Prevent the default so the window doesn't scroll and links don't open immediately.
				e.preventDefault();	
				
				// Get a reference to the element which triggered the touchstart.
				touchstartTarget = e.target;
				
				// Check for device. If not then testing on desktop.
				touchStartX = window.Touch ? e.touches[0].clientX : e.clientX;
				
				// Get the current transformX before the transition is removed.
				touchStartTransformX = getTransformX();
				
				// Set the transformX before the animation is stopped otherwise the animation will go to the end coord
				// instead of stopping at its current location which is where the drag should begin from.
				setTransformX(touchStartTransformX);
				
				// Remove the transition so the content doesn't tween to the spot being dragged. This also moves the animation to the end.
				$pageContainer.css("-webkit-transition", "none");
				
				// Create an interval to monitor how fast the user is dragging.
				interval = setInterval(measureDragSpeed, 20);
				
				document.addEventListener("touchmove", touchmoveHandler);
				document.addEventListener("touchend", touchendHandler);
				document.addEventListener("mousemove", touchmoveHandler);
				document.addEventListener("mouseup", touchendHandler);
			}
			
			function measureDragSpeed() {
				touchDragCoords.push(getTransformX());
			}
			
			function touchmoveHandler(e) {
				var deltaX = (window.Touch ? e.touches[0].clientX : e.clientX) - touchStartX;
				if (wasContentDragged || Math.abs(deltaX) > MOVE_THRESHOLD) { // Keep track of whether or not the user dragged.
					wasContentDragged = true;
					setTransformX(touchStartTransformX + deltaX);
				}
			}
			
			function touchendHandler(e) {
				document.removeEventListener("touchmove", touchmoveHandler);
				document.removeEventListener("touchend", touchendHandler);
				document.removeEventListener("mousemove", touchmoveHandler);
				document.removeEventListener("mouseup", touchendHandler);
				
				clearInterval(interval);
				
				e.preventDefault();
				
				if (wasContentDragged) { // User dragged more than MOVE_THRESHOLD so transition the content. 
					var previousX = getTransformX();
					var bSwitchPages;
					// Compare the last 5 coordinates
					for (var i = touchDragCoords.length - 1; i > Math.max(touchDragCoords.length - 5, 0); i--) {
						if (touchDragCoords[i] != previousX) {
							bSwitchPages = true;
							break;
						}
					}
					
					// User dragged more than halfway across the screen.
					if (!bSwitchPages && Math.abs(touchStartTransformX - getTransformX()) > (viewPortWidth / 2))
						bSwitchPages = true;
		
					if (bSwitchPages) {
						if (previousX > touchStartTransformX) { // User dragged to the right. go to previous page.
							if (selectedIndex > 0) { // Make sure user is not on the first page otherwise stay on the same page.
								selectedIndex--;
							}
						} else { // User dragged to the left. go to next page.
							if (selectedIndex + 1 < numPages) {// Make sure user is not on the last page otherwise stay on the same page.
								selectedIndex++;
							}
						}
						
						tweenTo(- selectedIndex * viewPortWidth);
						
						drawNavStatus();
					} else {
						tweenTo(touchStartTransformX);
					}
				} else { // User dragged less than MOVE_THRESHOLD trigger a click event.
					var event = document.createEvent("MouseEvents");
					event.initEvent("click", true, true);
					touchstartTarget.dispatchEvent(event);
				}
			}
			
			function drawNavStatus() {
				navStatusContext.clearRect(0, 0, navStatus.width(), navStatus.height());
				
				navStatusContext.shadowOffsetX = 0;
				navStatusContext.shadowOffsetY = 0;
				navStatusContext.shadowBlur = 0;
				navStatusContext.shadowColor = "rgba(0, 0, 0, 0)";
				
				var horizontalGap = 10;
				var radius = 4;
				
				var totalWidth = numPages * radius * 2 + (numPages - 1) * horizontalGap;
				var centerX = Math.round((navStatus.width() - totalWidth) / 2);
				var centerY = radius * 2;
				
				if (isDrawNavStatusBackground) {
					// draw the background first. semi circles on each end with a rectangle in the middle.
					navStatusContext.fillStyle = "rgba(0, 0, 0, .2)";
					navStatusContext.beginPath();
					navStatusContext.arc(centerX - 4, centerY + 4, radius * 3, Math.PI * -1.5, Math.PI + Math.PI * -1.5)
					navStatusContext.closePath();
					navStatusContext.fill();
					
					navStatusContext.beginPath();
					navStatusContext.fillRect(centerX - 4, 0, totalWidth, radius * 6);
					navStatusContext.closePath();
					navStatusContext.fill();
					
					navStatusContext.beginPath();
					navStatusContext.arc(totalWidth + centerX - 4, centerY + 4, radius * 3, Math.PI * 1.5, Math.PI + Math.PI * 1.5)
					navStatusContext.closePath();
					navStatusContext.fill();
				}
				
				// Create an inset shadow.
				navStatusContext.shadowOffsetX = -1;
				navStatusContext.shadowOffsetY = -1;
				navStatusContext.shadowBlur = 0;
				navStatusContext.shadowColor = "rgba(0, 0, 0, 1)";

				for (var i = 0; i < numPages; i++) {
					navStatusContext.fillStyle = i == selectedIndex ? "rgb(255, 255, 255)" : "rgb(89, 89, 89)";
					navStatusContext.beginPath();
					navStatusContext.arc(centerX + ((radius * 2 + horizontalGap) * i) + 1, centerY + 5, radius, 0, Math.PI * 2, true); 
					navStatusContext.closePath();
					navStatusContext.fill();
				}
			}
			
			// Returns the x of the transform matrix.
			function getTransformX() {
				var transformArray = $pageContainer.css("-webkit-transform").split(","); // matrix(1, 0, 0, 1, 0, 0)
				var transformElement = $.trim(transformArray[4]); // remove the leading whitespace.
				return transformX = Number(transformElement); // Remove the ). 
			}
			
			// Sets the x of the transform matrix.
			function setTransformX(value) {
				$pageContainer.css("-webkit-transform", "translateX("+ Math.round(value) + "px)");
			}
			
			function tweenTo(value) {
				isAnimating = true;
				targetTransformX = value;
				// Set the style for the transition.
				$pageContainer.css("-webkit-transition", "-webkit-transform " + ANIMATION_DURATION + "s");
				
				// Need to set the timing function each time -webkit-transition is set.
				// The transition is set to ease-out.
				$pageContainer.css("-webkit-transition-timing-function", "cubic-bezier(0, 0, 0, 1)");
				setTransformX(targetTransformX);
			}
			
			function dispatchTransitionEndEvent() {
				$this.trigger("transitionEnd");
			}
			
			function transitionEndHandler() {
				if (targetTransformX == getTransformX()) {
					dispatchTransitionEndEvent();
				}
			}

			this.getSelectedIndex = function() {
				return selectedIndex;
			}

			// Resets the layout.
			this.reset = function() {
				selectedIndex = 0;
				_setNumPages($pageContainer.children().length);
				setTransformX(0);
			}

			this.setNumPages = function(value) {
				_setNumPages(value);
			}
		});
	} else {
		$.error( 'Method ' +  method + ' does not exist on jQuery.horizontalPageContainer' );
	} 
}

})(jQuery);
