
(function() {
	
	var Renderer = function (canvasId, mapDatas) {
		this.NODE_HEIGHT = 20;
		this.NODE_BOADER_WIDTH = 2;
		this.NODE_TEXT_PADDING = 6;
		this.NODE_FONT_SIZE = 12;
		this.EDGE_LINE_WIDTH = 1;
		
		this.$container = $("#view-area");
		this.$canvas = $(canvasId);
		this.canvas = this.$canvas.get(0);
		this.gfx = arbor.Graphics(this.canvas);
		this.ctx = this.canvas.getContext("2d");
		this.particleSystem = null;
		
		this.reversedNodes = [];
		this.selectedNode = null;
		this.hoveredNode = null;
		this.mousePoint = null;
		this.dragOffset = {x: 0, y: 0};
		this.bHideBuilding = false;
		
		this.orgMapDatas = mapDatas;
		this.mapDatas = null;
		this.nodeColor = {
			1: "#ffdddd", // ダンジョン
			2: "#ddffdd", // 街
			3: "#ddddff", // 建物
			"search": "#ffffaa"
		};
	};
	
	Renderer.prototype = {
		init:function(system){
			this.particleSystem = system;
			this.particleSystem.screenSize(this.$canvas.width(), this.$canvas.height());
			this.particleSystem.screenPadding(50);
			this.resize();
			this.reset();
			this.initMouseHandling();
			this.gfx.textStyle({
				align: "center",
				baseline: "middle",
				font: "Arial",
				size: this.NODE_FONT_SIZE
			});
			$(window).resize($.proxy(this.resize, this));
		},
		resize: function() {
			this.canvas.width = this.$container.width();
			this.canvas.height = this.$container.height();
			this.particleSystem.screenSize(this.canvas.width, this.canvas.height);
			this.redraw();
		},
		reset: function() {
			this.particleSystem.prune();
			this.reversedNodes = [];
			this.mapDatas = $.extend(true, {}, this.orgMapDatas);
			this.addMapNodes([
				"[000]T01.rmd", // 古都
				"[193]T08.rmd", // アリアン
				"[036]T06.rmd"  // ハノブ
			]);
		},
		addNode: function(nodePath, nodeData, parentPath) {
			if (this.particleSystem.getNode(nodePath)) {
				return;
			}
			
			var parentNode = this.particleSystem.getNode(parentPath || "");
			
			$.extend(nodeData, {
				x: parentNode && parentNode.p.x * 0.8 + Math.random() * 0.02 - 0.01,
				y: parentNode && parentNode.p.y * 0.8 + Math.random() * 0.02 - 0.01,
				width: this.gfx.textWidth(nodeData.mapName) + this.NODE_TEXT_PADDING,
				alpha: 0
			});
			
			var newNode = this.particleSystem.addNode(nodePath, nodeData);
			this.particleSystem.tweenNode(newNode, 0.5, {alpha: 1});
			this.reversedNodes.unshift(newNode);
		},
		addEdge: function(source, target, edgeData) {
			$.extend(edgeData, {
				alpha: 0
			});
			
			var newEdge = this.particleSystem.addEdge(source, target, edgeData);
			this.particleSystem.tweenEdge(newEdge, 0.5, {alpha: 1});
		},
		addMapNodes: function(mapPaths) {
			var that = this;
			var nodePath, nodeData, i;
			
			$.each(mapPaths, function(index, nodePath) {
				nodeData = that.mapDatas[nodePath];
				
				if (nodeData.accessMap === "") {
					nodeData.clicked = true;
				}
				
				that.addNode(nodePath, nodeData);
			});
		},
		redraw: function () {
			var that = this;
			var fixedPoint;
			
			if (this.selectedNode) {
				fixedPoint = this.selectedNode.data.fixedPoint;
				this.selectedNode.p = that.particleSystem.fromScreen(fixedPoint);
			}
			
			this.gfx.clear();
			this.gfx.text("fps: " + this.particleSystem.fps(), 25, 15);
			this.particleSystem.eachEdge(function (edge, pt1, pt2) {
				if (that.bHideBuilding &&
					(edge.source.data.mapType == 3 ||
					edge.target.data.mapType == 3)) {
					
					return;
				}
				
				that.gfx.line(pt1, pt2, {
					stroke: edge.data.color || "black",
					alpha: edge.data.alpha,
					width: that.EDGE_LINE_WIDTH
				});
			});
			this.particleSystem.eachNode(function (node, pt) {
				var nodeData = node.data;
				var nodeColor = nodeData.clicked && that.nodeColor[nodeData.mapType];
				var label = nodeData.mapName || node.name;
				
				if (that.bHideBuilding && node.data.mapType == 3) {
					return;
				}
				
				that.gfx.rect(pt.x - nodeData.width / 2, pt.y - that.NODE_HEIGHT / 2, nodeData.width, that.NODE_HEIGHT, 6, {
					fill: nodeColor || "white",
					stroke: nodeData.isHovered ? "#cc7744" : "#505050",
					alpha: nodeData.alpha,
					width: that.NODE_BOADER_WIDTH
				});
				that.gfx.text(label, pt.x, pt.y, {
					color: nodeData.isHovered ? "#663300" : "black",
					alpha: nodeData.alpha,
				});
			});
		},
		search: function() {
			var that = this;
			var searchWord = $("#input-search").val() || "";
			var rword = new RegExp(searchWord);
			var resultName = "検索 " + searchWord;
			var edgeColor = randomColor(10);
			var matched = [];
			var mapPath, i;
			
			if (searchWord !== "") {
				$.each(this.mapDatas, function(mapPath, mapData) {
					if (rword.test(mapData.mapName)) {
						matched.push(mapPath);
					}
				});
				
				$("#search-result").text(matched.length + "件のマップが該当しました。");
				this.addMapNodes(matched);
				this.addNode(resultName, {
					mapType: "search",
					mapName: resultName,
					clicked: true
				});
				
				$.each(matched, function(index, matchedData) {
					that.addEdge(resultName, matchedData, {
						color: edgeColor
					});
				});
			}
		},
		initMouseHandling: function () {
			this.$canvas.on("mousedown touchstart", $.proxy(this.onMousedown, this));
			this.$canvas.on("mousemove", $.proxy(this.onMove, this));
			
			$("#form-search").on("submit", $.proxy(this.search, this));
			$("#btn-search").on("click", $.proxy(this.search, this));
			$("#btn-reset").on("click", $.proxy(this.reset, this));
			$("#check-hide-building").on("click", $.proxy(this.onClick_hideBuilding, this));
		},
		onMousedown: function(e) {
			this.getHoveredNode();
			
			if (e.type === "touchstart") {
				this.selectedNode = this.particleSystem.nearest(this.mousePoint).node;
			} else {
				this.selectedNode = this.hoveredNode;
			}
			
			if (this.selectedNode) {
				this.selectedNode.fixed = true;
				this.$canvas.on("mousemove", $.proxy(this.onDrag, this));
				this.$container.on("mouseup touchend", $.proxy(this.onDrop, this));
				this.onDrag(e);
				this.createAccess();
				this.updateYotsubaDetail();
			}
		},
		onMove: function(e) {
			if (this.selectedNode) {
				return;
			}
			
			var offset = this.$canvas.offset();
			
			this.mousePoint = arbor.Point(e.pageX - offset.left, e.pageY - offset.top);
			this.getHoveredNode();
			
			if (this.hoveredNode) {
				this.$canvas.addClass("hover-node");
			} else {
				this.$canvas.removeClass("hover-node");
			}
		},
		createAccess: function() {
			var that = this;
			var edgeColor = randomColor(10);
			var sourceNode = this.selectedNode;
			var sourcePath = sourceNode.name;
			var sourceData = this.mapDatas[sourcePath];
			var accessMaps, targetPath, targetData, index;
			
			if (sourceData && !sourceData.clicked) {
				accessMaps = sourceData.accessMap.split(",");
				
				$.each(accessMaps, function(index, targetPath) {
					targetData = that.mapDatas[targetPath];
					that.addNode(targetPath, targetData, sourcePath);
					
					if (targetData.accessMap === "" || targetData.accessMap === sourcePath) {
						targetData.clicked = true;
					}
					
					if (!that.particleSystem.getEdges(targetPath, sourcePath).length) {
						that.addEdge(sourcePath, targetPath, {
							color: edgeColor
						});
					}
				});
				
				sourceData.clicked = true;
			}
		},
		updateYotsubaDetail: function() {
			var mapPath = this.selectedNode.name;
			var mapData = this.mapDatas[mapPath];
			var mapName, yotsubaPath, param;
			
			if (mapData) {
				mapName = mapData.mapName;
				yotsubaPath = "https://dl.dropboxusercontent.com/u/70568694/MapDataBase/MapDataBase.html";
				param = "?Map=" + mapPath;
				$("#yotsuba-url").text(mapName).attr("href", yotsubaPath + param);
			}
		},
		getHoveredNode: function() {
			var that = this;
			
			this.hoveredNode = null;
			
			$.each(this.reversedNodes, function(index, node) {
				node.data.isHovered = false;
			});
			$.each(this.reversedNodes, function(index, node) {
				if (node._p.x === null || node._p.y === null) {
					return;
				}
				
				var pt = that.particleSystem.toScreen(node._p);
				
				if (that.mousePoint.y > pt.y - (that.NODE_HEIGHT + that.NODE_BOADER_WIDTH) / 2 &&
					that.mousePoint.y < pt.y + (that.NODE_HEIGHT + that.NODE_BOADER_WIDTH) / 2 &&
					that.mousePoint.x > pt.x - (node.data.width + that.NODE_BOADER_WIDTH) / 2 &&
					that.mousePoint.x < pt.x + (node.data.width + that.NODE_BOADER_WIDTH) / 2) {
					
					that.hoveredNode = node;
					that.dragOffset = {
						x: that.mousePoint.x - pt.x, 
						y: that.mousePoint.y - pt.y
					};
					return false;
				}
			});
			
			if (this.hoveredNode) {
				this.hoveredNode.data.isHovered = true;
			}
		},
		onDrag: function(e) {
			if (!this.selectedNode) {
				return;
			}
			
			var offset = this.$canvas.offset();
			var subPoint;
			
			this.mousePoint = arbor.Point(e.pageX - offset.left, e.pageY - offset.top);
			subPoint = this.mousePoint.subtract(this.dragOffset);
			this.selectedNode.p = this.particleSystem.fromScreen(subPoint);
			this.selectedNode.data.fixedPoint = subPoint;
		},
		onDrop: function(e) {
			if (!this.selectedNode) {
				return;
			}
			
			this.selectedNode.fixed = false;
			this.selectedNode.tempMass = 50;
			this.selectedNode = null;
			this.$canvas.off("mousemove", this.onDrag);
			this.$container.off("mouseup", this.onDrop);
		},
		onClick_hideBuilding: function() {
			this.bHideBuilding = $("#check-hide-building").is(":checked");
			this.redraw();
		}
	};
	
	function randomColor(max) {
		var hex = [];
		max = max || 16;
		
		for (var i = 0; i < 6; i++) {
			hex[i] = (Math.floor(Math.random() * max)).toString(16);
		}
		
		return "#" + hex.join("");
	}
	
	$(function () {
		$.getJSON("./data/mapDatas.json", function(mapDatas) {
			var sys = arbor.ParticleSystem();
			sys.parameters({
				stiffness: 1000,
				repulsion: 1000,
				friction: 0.5,
				gravity: true,
				timestep: 0.05,
				dt: 0.010
			});
			sys.renderer = new Renderer("#viewport", mapDatas);
		});
	});
})();
