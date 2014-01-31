(function($) {
$.fn.dropDown = function(method) {
	if (this[0][method]) {
		return this[0][ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
	} else if ( typeof method === 'object' || ! method ) {
		return this.each(function() {
			var ITEM_HEIGHT = 40;
			var BACKGROUND_PADDING = 5;
			var WIDTH = 250;
			var TRIANGLE_HEIGHT = 6;
			var TRIANGLE_WIDTH = 18;
			
			var isOpen = false;
			var $menu;
			
			var selectedIndex;
			var $this = $(this);
			var verticalGap = method.verticalGap; // The gap between the triangle and the button that opens/closes the menu.
			
			var isRedraw;
			
			var triggered;
	
			init(method);
			
			function init(options) {
				// Add a handler for when a user clicks the icon to open the dropdown.
				$this.on("click", clickHandler);
			}
			
			function clickHandler() {
				if (isOpen) {
					close();
				} else {
					var numItems = $this.children().length;
					
					isOpen = true;
					triggered = false;
					
					if ($menu && !isRedraw) {
						$menu.css("display", "inline");
						$menu.appendTo("body");
						$modal.appendTo("body");
					} else {
						if (isRedraw) {
							$menu.remove();
							$("body").off("mousedown touchstart", ".drop-down-menu .item");		
						}
						
						var itemHtml = "";
						var children = $this.children();
						var isFlipSwitch = false;
						var flipSwitchState;
						// Loop through each item and create the html for the items.
						for (var i = 0; i < numItems; i++) {
							var child = $(children[i]);
							var style = "";
							if (i == 0)
								style = "item item-first"; // Adds rounded corners in the top left and right so the selection highlight has rounded corners.
							else if (i +1 == numItems)
								style = "item item-last"; // Adds rounded corners in the bottom left and right so the selection highlight has rounded corners.
							else
								style = "item";
								
							if (child.attr("class") == "flip-switch") { // The menu item contains a flip switch control.
								itemHtml += "<div class='" + style + " ' control='" + child.attr("class") + "'>";
								itemHtml +=     "<div class='control-label'>" + child.html() + "</div>";
								itemHtml +=     "<div class='flip-switch' id='" + child.attr('id') +"'></div>";
								itemHtml += "</div>";
								
								isFlipSwitch = true;
								
								flipSwitchState = child.attr('state');
							} else {
								itemHtml += "<div class='" + style + " ' id='" + child.attr('id') + "' >" + child.html() + "</div>";
							}
							
							if (i + 1 < numItems) // add a divider for the items except for the last one.
								itemHtml += "<hr>";
						}
						
						// Add handler for when the user selects an item.
						$("body").on("mousedown touchstart", ".drop-down-menu .item", function(e) {
							var $item = $(e.currentTarget);
							if ($item.attr("control") == "flip-switch") // Don't do anything if the row is a flipswitch.
								return;
								
							$item.addClass("selected");
							
							// User selected an item. Show the highlight for 70ms then fadeout the menu.
							$item.one("mouseup touchend", function() {
								$menu.delay(70).fadeOut(200, function() {
									$item.removeClass("selected");// Remove the selected state.
									$item.off("mouseout touchleave mouseover touchmove");
									selectedIndex = Math.floor($item.index() / 2); // Take into account the <hr> elements.
									
									if (!triggered) {
										triggered = true;
										$this.trigger("change", $item.attr("id"));
										close();
									}
								});
							});
							
							$item.on("mouseout touchleave", function() {
								$item.removeClass("selected");
							});
							
							$item.on("mouseover touchmove", function() {
								$item.addClass("selected");
							})
						});
				
						var height = ITEM_HEIGHT * numItems + BACKGROUND_PADDING * 2 - 8; // Subtract 8 from the height to offset padding.
		
						var html  = "<div class='drop-down-menu'>";
						    html +=    "<canvas id='dropDownCanvas' width='" + WIDTH + "' height='" + TRIANGLE_HEIGHT + "'>";
						    html +=    "</canvas>";
						    html +=    "<div class='drop-down-menu-background' style='width:" + (WIDTH - 10) + "px;height:" + height + "px'>"; // subtract 10 from the width to offset padding.
						    html +=        "<div class='drop-down-menu-inner-background'>" + itemHtml + "</div>";
						    html +=    "</div>";
						    html += "</div>";
						
						$menu = $(html).appendTo("body");
						
						// Create a modal background to stop clicks.
						$modal = $("<div class='modal-background'></div>").appendTo("body");
						$modal.css("display", "inline");
						
						$modal.on("click", modalBackground_clickHandler);
						
						// Add the flip switch. Currently this only supports one flip switch in the menu.
						$(".drop-down-menu-inner-background .flip-switch").flipSwitch({state: flipSwitchState});
						
						var canvas = document.getElementById("dropDownCanvas");
						var ctx = canvas.getContext("2d");
						
						// Calculate the y coord of the bottom of the button.
						var offset = $this.offset();
						var horizontalOffset = 8;
						var x;
						var triangleX;
						// Attempt to position from the left.
						// Offset the x of the rectangle by 8 to the left of the arrow.
						// Add 10 to the width to take into account the padding for the inner background.
						if (offset.left - 8 + WIDTH + 10 > $(window).width()) { // dropdown will go over the right edge so shift to the left.
							x = $(window).width() - 5 - WIDTH;
							triangleX = offset.left + ($this.width() / 2) - x;
						} else { // position the dropdown with the button.
							x = offset.left - 5;
							triangleX = 5 + ($this.width() / 2);
						}
		
						$menu.css("left", x);
						// Draw the triangle.
						ctx.beginPath();
						ctx.moveTo(triangleX, 0);
						ctx.lineTo(triangleX + TRIANGLE_WIDTH / 2, TRIANGLE_HEIGHT);
						ctx.lineTo(triangleX - TRIANGLE_WIDTH / 2, TRIANGLE_HEIGHT);
						ctx.fill();
					}
					
					isRedraw = false;
					
					// Change the y coord in case the user scrolled. Assume the x coord does not change.
					var y = $this.offset().top + $this.height() + ($this.parents().css("position") == "fixed" ? -$(window).scrollTop() : 0) + $(window).scrollTop();
					$menu.css("top", y + verticalGap);
				}
			}
			
			function modalBackground_clickHandler(e) {
				close();
			}
			
			function close() {
				isOpen = false;
				
				$menu.detach();
				$modal.detach();
			}
			
			/**
			 * Public functions.
			 */
			this.getSelectedIndex = function() {
				return selectedIndex;
			}
			
			this.getSelectedLabel = function() {
				return $($this.children()[selectedIndex]).html();
			}
			
			// Forces a redraw of the menu the next time it is opened.
			// This should be used when the HTML of an item has changed such as toggling between login/logout.
			this.invalidate = function() {
				isRedraw = true;
			}
		});
	} else {
		$.error( 'Method ' +  method + ' does not exist on jQuery.dropDown' );
	} 
}
})(jQuery);
