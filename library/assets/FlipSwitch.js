(function($) {
	$.fn.flipSwitch = function(options) {
		return this.each(function() {
			var LEFT_BOUND = -54;
			var RIGHT_BOUND = -3;
			
			var $this = $(this);
			
			var isOn = true;
			if (options && options.state == "off") {
				$this.css("background-position", -54);
				isOn = false;
			}
			
			var mouseDownX;			// The start coordinate of the mouse.
			var wasContentDragged;	// Flag for whether or not the user dragged.
			var startX;				// The start coordinate of the background.
			var targetX;			// The x when dragging.
			
			this.addEventListener("touchstart", touchstartHandler);
			this.addEventListener("mousedown", touchstartHandler);
			
			function touchstartHandler(e) {
				e.preventDefault();
				
				startX = Number($this.css("background-position").split("px")[0]);
				mouseDownX = window.Touch ? e.touches[0].clientX : e.clientX;
				wasContentDragged = false;
				
				document.addEventListener("touchmove", touchmoveHandler);
				document.addEventListener("touchend", touchendHandler);
				document.addEventListener("mousemove", touchmoveHandler);
				document.addEventListener("mouseup", touchendHandler);
			}
			
			function touchmoveHandler(e) {
				var clientX = window.Touch ? e.touches[0].clientX : e.clientX;
				if (wasContentDragged || Math.abs(clientX - mouseDownX) > 10) {
					wasContentDragged = true;
					
					var deltaX = clientX - mouseDownX;
					targetX = startX + deltaX;
					if (targetX < LEFT_BOUND) // Don't go past the left edge.
						targetX = LEFT_BOUND;
					else if (targetX > RIGHT_BOUND) // Don't go past the right edge.
						targetX = RIGHT_BOUND;
					$this.css("background-position", targetX);
				}
			}
			
			function touchendHandler(e) {
				document.removeEventListener("touchmove", touchmoveHandler);
				document.removeEventListener("touchend", touchendHandler);
				document.removeEventListener("mousemove", touchmoveHandler);
				document.removeEventListener("mouseup", touchendHandler);
				
				var previousIsOn = isOn;
				if (wasContentDragged) {
					if (targetX > (LEFT_BOUND - RIGHT_BOUND) / 2) {
						isOn = true;
						$this.css("background-position", RIGHT_BOUND);
					} else {
						isOn = false;
						$this.css("background-position", LEFT_BOUND);
					}
				} else {
					// User tapped the control so toggle the state.
					$this.css("background-position", isOn ? LEFT_BOUND : RIGHT_BOUND);
					isOn = !isOn;
				}
				
				if (previousIsOn != isOn)
					$this.trigger("change", isOn);
			}
			
			return this;
		})
	}
})(jQuery);
