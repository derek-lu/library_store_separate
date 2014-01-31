(function($) {
$.fn.toggleButton = function(method) {
	if ( this[0][method] ) {
		return this[0][ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
	} else if ( typeof method === 'object' || ! method ) {
		return this.each(function() {
			var $this = $(this);
			var isUp = true;
			
			init(method);
			
			function init(options) {
				$this.addClass($this.attr("up-skin-style"));
				var options = options;
				$this.html(options.upLabel);
				$this.on("click", function() {
					isUp = !isUp;
					
					if (isUp) {
						$this.removeClass($this.attr("selected-skin-style"));
						$this.addClass($this.attr("up-skin-style"));
					} else {
						$this.addClass($this.attr("selected-skin-style"));
						$this.removeClass($this.attr("up-skin-style"));
					}
					
					$this.html(isUp ? options.upLabel : options.selectedLabel);
				});
			}

			// Public
			this.getState = function() {
				return isUp;
			}
		});
	} else {
		$.error( 'Method ' +  method + ' does not exist on jQuery.toggleButton' );
	}  
}

})(jQuery);
