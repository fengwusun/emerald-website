// This global variable hold the current WCSSession instance
let wcsSession = null;
const INIT_ERROR = "WCSLIB not initialized";
const ORIGIN = 1;
const is_ra_dec = true;
const pointerState = { x: 0, y: 0 };
const skyCoordState = { ra: 0, dec: 0 };



function pad80(s) {
  if (s.length > 80) return s.slice(0, 80);
  return s.padEnd(80, " ");
}

function makeFitsHeader(cards) {
  const safeCards = [...cards, "END"];
  const joined = safeCards.map(pad80).join("");
  return joined;
}

function allocateUTF8(module, str) {
  const utf8 = new TextEncoder().encode(str + "\0"); // null-terminated
  const ptr = module._malloc(utf8.length);
  // Create a view into WASM memory at the allocated pointer
  const heapView = new Uint8Array(module.HEAPU8.buffer, ptr, utf8.length);
  heapView.set(utf8);
  return ptr;
}


class WcsSession {
  constructor(Module, fitsHeader) {
    this.Module = Module;
    this.headerPtr = allocateUTF8(Module, fitsHeader);
    this.raPtr = Module._malloc(8);
    this.decPtr = Module._malloc(8);
    this.xPtr = Module._malloc(8);
    this.yPtr = Module._malloc(8);
    const status = Module._getWcs(this.headerPtr);
    if (status !== 0) throw new Error("WCSLIB init failed: " + status);
  }

  pixToSky(x, y, origin = 0, target) {
    const x1 = origin === 0 ? x + 1 : x;
    const y1 = origin === 0 ? y + 1 : y;

    const status = this.Module._pix2sky(x1, y1, this.raPtr, this.decPtr);

    if (status !== 0) throw new Error("pix2sky failed: " + status);
    const output = target || { ra: 0, dec: 0 };
    output.ra = this.Module.getValue(this.raPtr, "double");
    output.dec = this.Module.getValue(this.decPtr, "double");
    return output;
  }

  skyToPix(ra, dec, origin = 0, target) {
    const status = this.Module._sky2pix(ra, dec, this.xPtr, this.yPtr);
    if (status !== 0) throw new Error("sky2pix failed: " + status);
    const output = target || { x: 0, y: 0 };
    let x = this.Module.getValue(this.xPtr, "double");
    let y = this.Module.getValue(this.yPtr, "double");
    if (origin === 0) {
      x -= 1;
      y -= 1;
    }
    output.x = x;
    output.y = y;
    return output;
  }

  free() {
    if (this.headerPtr) {
      this.Module._free(this.headerPtr);
      this.headerPtr = null;
    }
    ["raPtr", "decPtr", "xPtr", "yPtr"].forEach(key => {
      if (this[key]) {
        this.Module._free(this[key]);
        this[key] = null;
      }
    });
  }
}

// Before using any of the WCS functions, we need to load and initialize WCSLIB
// asynchronously, once the WASM module is ready and the FITS header is loaded,
// we dispatch a custom event "wcsIsReady" to notify other parts of the code.
Module.onRuntimeInitialized = () => {
  console.log("WCSLIB module loaded");
  fetch("js/header_data.txt").then(response => response.text()).then(text => {
    console.log("FITS header loaded");
    const cards = text.split('\n');
    const fitsHeader = makeFitsHeader(cards);
    wcsSession = new WcsSession(Module, fitsHeader);
    console.log("WCSLIB session initialized");
    let isReadyEvent = new Event("wcsIsReady");
    window.dispatchEvent(isReadyEvent);


    // TEST WCS -- SKIPPING BECUASE THIS USES GOODS Coords and fails
    var rd = [53.122781107619, -27.805160455556];
    var check_xy = [22972.5, 27629.5];
    //radec = pixToSky(check_xy,0,0); //some inaccuracy, but conversion OK
    //console.log('Test PixToSky check_xy',check_xy,'ra/dec',radec,'check ra/dec',rd);
    //xy = skyToPix(rd);
    //console.log('Test SkyToPix rd',rd,'xy',xy,'check xy',check_xy);
  }).catch(err => console.log("Error loading FITS header:", err));
};


function urlParam(name){
    // Get URL parameter by name
    // Example:
    // For URL: http://www.example.com/page?zoom=8&lat=500&lng=30.0
    // urlParam('lat') = 500,
    // urlParam('lng') = 30.0,
    // urlParam('zoom') = 8
    const results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results==null){
        return null;
    }
    else{
        return decodeURI(results[1]) || 0;
    }
}


function pixToSky(xy){
    if (!wcsSession) throw new Error(INIT_ERROR);

    let x, y;
    if (xy.hasOwnProperty('lng')){
        x = xy.lng;
        y = xy.lat;
    } else {
        x= xy[0];
        y= xy[1];
    }
    const res = wcsSession.pixToSky(x, y, ORIGIN);
    return [res.ra, res.dec];
}

function skyToPix(rd){
    if (!wcsSession) throw new Error(INIT_ERROR);
    const res = wcsSession.skyToPix(rd[0], rd[1], ORIGIN);
    return [res.x, res.y];
}

function skyToLatLng(rd){
    var xy = skyToPix(rd);
    // console.log('skyToPix rd',rd,'xy',xy)
    return L.latLng(xy[1], xy[0]);
}

function panToSky(rd, zoom, map){
    var ll = skyToLatLng(rd)
    map.setZoom(zoom);
    map.panTo(ll, zoom);
}

function panFromUrl(map){
    // Pan map based on ra/dec/[zoom] variables in location bar
    var ra = urlParam(is_ra_dec ? 'ra' : 'x');
    var dec = urlParam(is_ra_dec ? 'dec' : 'y');
    var zoom = urlParam('zoom');
    console.log('ra',ra)
    console.log('dec',dec)
    console.log('zoom',zoom)
    if (ra != null & dec != null){
        panToSky([parseFloat(ra), parseFloat(dec)],
                 (zoom != null) ? parseInt(zoom) : default_zoom,
                 map);
    }
}

function updateLocationBar(){
    var rd = pixToSky(map.getCenter());
    //console.log(rd);
    var params = `${is_ra_dec ? "ra" : "x"}=` + rd[0].toFixed(7);
    params += `&${is_ra_dec ? "dec" : "y"}=` + rd[1].toFixed(7);
    params += '&zoom=' + map.getZoom();
    //console.log(params);
    var param_url = window.location.href.split('?')[0] + '?' + params;
    window.history.pushState('', '', param_url);
}

// Free the WCSSession instance when the page is unloaded
window.addEventListener("beforeunload", () => {
  if (wcsSession) {
    wcsSession.free();
    wcsSession = null;
  }
});
