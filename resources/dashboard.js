(function(root){

	var lad = {};

	function Dashboard(opts){
		
		if(!opts) opts = {};
		this.opts = opts;

		// Define Local Authority Districts
		var auth = document.querySelectorAll('.authority');
		
		// Update styles
		var style = document.createElement('style');
		style.innerHTML = ".grid { grid-template-columns: repeat("+auth.length+", 1fr); }";
		for(var i = 0; i < auth.length; i++){
			la = auth[i].getAttribute('id');
			lad[la] = {};
			lad[la].population = (opts.population[la]||"");
			style.innerHTML += '.'+la+' { grid-column: '+(i+1)+' }';
		}
		// Set grid row styling
		i = 0;
		for(var id in this.opts.panel){
			style.innerHTML += '.grid .row-'+(i+2)+' { grid-row: '+(i+2)+'; }';
			i++;
		}
		// Set media styling
		style.innerHTML += '@media only screen and (max-width: 640px) {';
		i = 0;
		for(var i = 0; i < auth.length; i++){
			la = auth[i].getAttribute('id');
			style.innerHTML += '.grid .'+la+' { grid-column: 1; }';
		}
		style.innerHTML += '.grid { grid-template-columns: 1fr;';
		style.innerHTML += '}'
		// append the style to the DOM in <head> section
		document.head.appendChild(style);


		var promises = [];
		for(var la in lad) promises.push(this.getDataForLA(la));
		
		// Get death data (from other repo)
		promises.push(fetch("https://odileeds.github.io/covid-19/LocalAuthorities/data/death-summary.json",{'method':'GET'})
			.then(response => { return response.json() })
			.then(json => {
				for(var la in json){
					if(lad[la]) lad[la].deaths = json[la];
				}
			})
		);

		

		promises.map(p => p.catch(e => e));
		Promise.all(promises).then(responses => {
			for(var la in lad) displayLA(la);
		});


		return this;
	}

	// Identify panels in DOM and put in loading animations
	Dashboard.prototype.initPanels = function(la){

		var i = 0;
		var existing = document.querySelectorAll('.'+la);

		for(var id in lad[la].panels){
			// Get a copy of the panels
			cpanels = lad[la].panels[id];
			// Update the structure
			lad[la].panels[id] = {'_parent':document.querySelector('.'+la+'.'+id)};

			if(!lad[la].panels[id]._parent){
				// Need to add this panel 
				if(existing.length > 0){
					var panel = document.createElement('div');
					panel.classList.add(la);
					panel.classList.add('cell');
					panel.classList.add('row-'+(i+2));
					panel.classList.add(id);
					panel.classList.add('padded');
					panel.setAttribute('tabindex',0);
					// Append it 
					existing[existing.length-1].insertAdjacentElement('afterend', panel);
					existing = [panel];
					lad[la].panels[id]._parent = panel;
				}
			}
			if(lad[la].panels[id]._parent){
				// Clear any contents
				lad[la].panels[id]._parent.innerHTML = "";
				// Create each area within each panel
				for(var p = 0; p < cpanels.length; p++){
					lad[la].panels[id][cpanels[p].key] = cpanels[p];
					lad[la].panels[id][cpanels[p].key].el = document.createElement(cpanels[p].tagname);
					lad[la].panels[id][cpanels[p].key].el.classList.add(cpanels[p]['key']);
					if(cpanels[p]['class']) lad[la].panels[id][cpanels[p].key].el.classList.add(cpanels[p]['class']);
					if(typeof cpanels[p].html==="string"){
						lad[la].panels[id][cpanels[p].key].el.innerHTML = cpanels[p].html;
					}else if(typeof cpanels[p].html==="function"){
						//lad[la].panels[id][panels[p].key].innerHTML = panels[p].html.call(this,la);
					}
					
					lad[la].panels[id]._parent.append(lad[la].panels[id][cpanels[p].key].el);
					if(cpanels[p]['key'] == "number"){
						// If we have a "number" area, put a loading animation in it
						load = document.createElement('img');
						load.src = "resources/odi.svg";
						load.classList.add('spinner');
						lad[la].panels[id][cpanels[p].key].el.append(load);
					}
				}
			}else{
				console.error("Can't find "+la+"."+id);
			}
			i++;
		}
		return;
	}
	function displayLA(la){

		if(!lad[la].json){
			console.error('No JSON for '+la);
			return;
		}
		var start = 2;
		// Work out weekly totals
		var latest = new Date(lad[la].json.data[start].date);
		var weeks = [{'total':0,'days':0,'upto':lad[la].json.data[start].date}];
		for(var i = start; i < lad[la].json.data.length; i++){
			d = new Date(lad[la].json.data[i].date);
			w = Math.floor(((latest-d)/86400000)/7);
			if(weeks.length <= w) weeks.push({'total':0,'days':0,'upto':lad[la].json.data[i].date});
			weeks[w].total += lad[la].json.data[i]['newCasesBySpecimenDate'];
			weeks[w].days++;
		}
		lad[la].weeks = weeks;
		
		// Update the panels
		var v,id,bit;
		for(id in lad[la].panels){
			for(bit in lad[la].panels[id]){
				if(bit != "_parent"){
					v = "";
					if(typeof lad[la].panels[id][bit].html==="string") v = lad[la].panels[id][bit].html;
					else if(typeof lad[la].panels[id][bit].html==="function") v = lad[la].panels[id][bit].html.call(lad[la],la);
					
					if(bit == "number"){
						if(typeof v==="number"){
							animateNumber(lad[la].panels[id][bit].el,v,300,'','');
						}else{
							lad[la].panels[id][bit].el.innerHTML = v;
							//if(lad[la].panels[id][bit].fit) window.fitText(lad[la].panels[id][bit].el,0.7,{'len':v.length,'minFontSize':12,'minChar':4});
						}
					}else{
						lad[la].panels[id][bit].el.innerHTML = v;
					}
					if(lad[la].panels[id][bit].fit) window.fitText(lad[la].panels[id][bit].el,0.7,{'len':(v+"").length,'minFontSize':12,'minChar':4});
				}
			}
		}

		return this;
	}
	Dashboard.prototype.getDataForLA = function(la){
		url = "https://api.coronavirus.data.gov.uk/v1/data?filters=areaType=ltla;areaCode={{LA}}&structure=%7B%22date%22:%22date%22,%22areaName%22:%22areaName%22,%22areaCode%22:%22areaCode%22,%22newCasesBySpecimenDate%22:%22newCasesBySpecimenDate%22,%22cumCasesBySpecimenDate%22:%22cumCasesBySpecimenDate%22%7D&format=json";
		lad[la].url = url;
		url = url.replace(/\{\{LA\}\}/,la);
		console.info('Getting data for '+la+' from '+url);
		lad[la].panels = clone(this.opts.panel);
		this.initPanels(la);
		
		return fetch(url,{'method':'GET'})
		.then(response => { return response.json() })
		.then(json => {
			lad[la].json = json;
			//load.parentNode.removeChild(load);
			//displayLA(la);
		}).catch(error => {
			console.error(error,url);
			lad[la] = {};
		});
	}

	// shim layer with setTimeout fallback
	window.requestAnimFrame = (function(){
		return  window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function( callback ){ window.setTimeout(callback, 1000 / 60); };
	})();

	function formatNumber(v){
		if(typeof v !== "number") return v;
		if(v > 1e7) return Math.round(v/1e6)+"M";
		if(v > 1e6) return (v/1e6).toFixed(1)+"M";
		if(v > 1e5) return Math.round(v/1e3)+"k";
		if(v > 1e4) return Math.round(v/1e3)+"k";
		return v;
	}
	function animateNumber(el,val,duration,pre,post,callback){
		if(typeof val!=="number"){
			val = el.innerHTML;
			if(val) val = parseFloat(val);
			el.innerHTML = '';
		}
		el.innerHTML = '';
		if(!pre) pre = "";
		if(!post) post = "";
		var start = new Date();
		var v;
		function frame(){
			var now = new Date();
			// Set the current time in seconds
			var f = (now - start)/duration;
			if(f < 1){
				v = formatNumber(Math.round(val*f));
				el.innerHTML = (pre+v+post);
				requestAnimFrame(frame);
			}else{
				el.innerHTML = (pre+formatNumber(val)+post);
				if(typeof callback==="function") callback.call(el);
			}
		}
		if(typeof val==="number") frame();
		return;			
	}
	


	window.Dashboard = function(opts){
		return new Dashboard(opts);
	}

})(window || this);
