
var map, geocoder, marker, OSMCopyright = null;
var streetPaths = [];

var communicating = false;

function renderStreets() {
  var list = $('#list');

  var append = function (name, ident, type, rus) {
    var item = $('<li>' + name + '</li>').on('click', function () {
      if (communicating) {
        return false;
      }
      var replaced = name
            .replace('пров.', 'провулок')
            .replace('в-д', 'в\'їзд')
            .replace('пр-д', 'проїзд')
            .replace('вул.', 'вулиця')
            .replace('просп.', 'проспект');
      codeAddress(replaced, name + ', Харків, Харківська область');
    });
    item.data('ident', ident);
    item.data('type', type);
    list.find('#' + type + ' ul').append(item);
  };

  $.each(streets, function (idx, street) {
    var full = street.ukr_type + ' ' + street.ukr_name;
    append(full, full, 'streets', street.rus_name + ' ' + street.rus_type);
  });
  $.each(districts, function (idx, distr) {
    append(distr.ukr_name + ' район', distr.ukr_name, 'districts', distr.rus_name + ' ' + distr.rus_type);
  });
  $.each(metros, function (idx, m) {
    append('ст. м. ' + m.ukr_name, m.ukr_name, 'metros', m.rus_name + ' ' + m.rus_type);
  });
  $.each(parks, function (idx, park) {
    append('парк ' + park.ukr_name, park.ukr_name, 'parks', park.rus_name + ' ' + park.rus_type);
  });
}

function drawStreet(coordinates, map) {
  var latlngs = coordinates.map(function(pair) {
    return new google.maps.LatLng(pair[1], pair[0]);
  });

  var path = new google.maps.Polyline({
    path: latlngs,
    geodesic: true,
    strokeColor: '#CF19DB',
    strokeOpacity: 0.5,
    strokeWeight: 8
  });

  streetPaths.push(path);

  path.setMap(map);
}

function initialize() {
  var description = $('#description');
  var showDescription = function (ident, type) {
    description.html('');
    var d = $.grep(all[type], function (item) {
      if (item.ukr_name) {
        return (item.ukr_type + ' ' + item.ukr_name == ident)
          || item.ukr_name == ident;
      } else return false;
    })[0];
    description.html('<h3>Причина для перейменування</h3><p class="well">' + d.description + '</p>');
  };

  geocoder = new google.maps.Geocoder();
  var mapOptions = {
    center: {lat: 50.004444, lng: 36.231389},
    zoom: 15
  };
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
  renderStreets();

  $('#list .tab-pane ul').on('click', 'li', function () {
    $('#list .tab-pane ul li.selected').removeClass('selected');
    $(this).addClass('selected');
    showDescription($(this).data('ident'), $(this).data('type'));
  });

  OSMCopyright = $('<div/>', {
    id: 'map-copyright',
    style: 'font-size: 11px; font-family: Arial, sans-serif; margin: 0 2px 2px 0; white-space: nowrap;'
  });
  map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(OSMCopyright.get(0));
}

function geocodeViaGoogle(address) {
  return $.Deferred(function (dfd) {
    geocoder.geocode({'address': address}, function (results, status) {
      if (status != google.maps.GeocoderStatus.OK) {
        console.log('Failed to load address data for ' + address + 'from Google. Reason: ' + status);
      }
      dfd.resolve(results[0]);
    });
  });
}

function geocodeViaOSM(address) {
  return $.Deferred(function (dfd) {
    $.ajax({
      url: 'http://nominatim.openstreetmap.org/search',
      type: 'get',
      data: {
        street: address,
        city: 'Харьков',
        country: 'Украина',
        format: 'json',
        polygon_geojson: 1
      }
    }).done(function (data, result) {
      if (!data.length || result != 'success') {
        console.log('Failed to get data from OSM service for ' + address + '. Result ' + result);
        OSMCopyright.html("");
      } else {
        OSMCopyright.html('Street Location ' + data[0].licence);
      }
      dfd.resolve(data);
    });
  });
}

function removePaths() {
  streetPaths.forEach(function(path) {
    path.setMap(null);
  });
  streetPaths = [];
}

function codeAddress(address, full) {
  communicating = true;
  $.when(geocodeViaGoogle(full), geocodeViaOSM(address))
    .always(function(){
      communicating = false;
    })
    .done(function (googleRes, OSMRes) {
    var location = googleRes.geometry.location;

    map.setCenter(location);
    if (marker) {
      marker.setMap(null);
    }

    var selectedTab = $('.nav-tabs').find('li.active a').attr('id');
    var markerIcon = null;

    switch (selectedTab) {
    case 'streets-tab':
      markerIcon = 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
      break;
    case 'districts-tab':
      markerIcon = 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
      break;
    case 'metro-tab':
      markerIcon = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      break;
    case 'parks-tab':
      markerIcon = 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png';
      break;
    }
    marker = new google.maps.Marker({
      map: map,
      position: location,
      icon: markerIcon
    });

    var coordinates = OSMRes.filter(function(c) {
      if (c.osm_type === 'way' && c.class === 'highway' && c.type !== 'secondary') {
        if (/ровулок/.test(address)) {
          return / Lane/.test(c.display_name);
        } else if (/'їзд/.test(address)) {
          var m;
          if ((m = /(\d-)i/.exec(c.display_name))) {
            return address.indexOf(m[1]) > -1;
          } else {
            return / Entrance/.test(c.display_name);
          }
        } else if (/роспект/.test(address)) {
          return / Avenue/.test(c.display_name);
        } else if (/шосе /.test(address) && c.type !== 'residential') {
          return / Road/.test(c.display_name);
        } else {
          return !/ Lane/.test(c.display_name) && !/ Entrance/.test(c.display_name) && !/ Avenue/.test(c.display_name) && !/ Road/.test(c.display_name);
        }
      }
      return false;
    });

    coordinates = coordinates.map(function(street) {
      return street.geojson.coordinates;
    });

    var mergedCoords = [].concat.apply([], coordinates);
      removePaths();
      coordinates.forEach(function(el){
        drawStreet(el, map);
      });
  });
}
google.maps.event.addDomListener(window, 'load', initialize);
