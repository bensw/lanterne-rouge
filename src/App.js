import React, { useState } from 'react';
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import haversine from 'haversine-distance';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow
});

L.Marker.prototype.options.icon = DefaultIcon;


const App = () => {
  const [stops, setStops] = useState([]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const tcxData = event.target.result;
      // const parsedData = parse(tcxData);
      const trackPoints = parseTcxData(tcxData);
      const detectedStops = detectStops(trackPoints);
      setStops(detectedStops);
    };

    reader.readAsText(file);
  };
  const centerCoords = stops.length !== 0 ? findCenterPoint(stops.map(s => s.position)) : [51.505, -0.09]
  return (
    <div>
      <input type="file" accept=".tcx" onChange={handleFileUpload} />

      <MapContainer key={stops.length} center={centerCoords} zoom={13} style={{ height: "100vh", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {stops.map((stop, idx) => (
          <Marker key={idx} position={stop.position}>
            <Tooltip>
              Stop {idx+1}: {formatDuration(stop.duration)}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default App;

// function parseTcxData(tcxData) {
//   return tcxData.activities[0].laps[0].trackpoints.map(tp => ({
//     time: new Date(tp.time),
//     latitude: tp.position.latitudeDegrees,
//     longitude: tp.position.longitudeDegrees,
//   }));
// }
function parseTcxData(tcxData) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(tcxData, "text/xml");

  const trackpoints = xmlDoc.getElementsByTagName("Trackpoint");
  const parsedTrackpoints = Array.from(trackpoints).map(trackpoint => {
    const time = trackpoint.getElementsByTagName("Time")[0].textContent;
    const position = trackpoint.getElementsByTagName("Position")[0];
  
    if (!position) {
      return null; // Skip this trackpoint if position is undefined
    }
  
    const latitude = position.getElementsByTagName("LatitudeDegrees")[0].textContent;
    const longitude = position.getElementsByTagName("LongitudeDegrees")[0].textContent;
  
    return {
      time: new Date(time),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    };
  }).filter(trackpoint => trackpoint !== null); // Filter out the null values
  
  return parsedTrackpoints;
}

// function detectStops(trackPoints) {
//   const stops = [];
//   let i = 0;

//   while (i < trackPoints.length) {
//     const start = trackPoints[i];
//     let end = start;

//     // Find the end of the current stop
//     while (i < trackPoints.length - 1 && haversineDistance(end, trackPoints[i + 1]) < 1) {
//       end = trackPoints[i + 1];
//       i++;
//     }

//     // If the stop lasted for at least 20 seconds, add it to the stops array
//     const duration = (end.time - start.time) / 1000;
//     if (duration >= 5) {
//       stops.push({
//         start: start.time,
//         end: end.time,
//         duration: duration,
//         position: [start.latitude, start.longitude],
//       });
//     }

//     i++;
//   }

//   return stops;
// }
function detectStops(trackPoints) {
  const stops = [];
  let i = 0;

  while (i < trackPoints.length - 1) {
    let start = trackPoints[i];
    let end;

    // Find the end of the 20-second window
    let j = i + 1;
    while (j < trackPoints.length && (trackPoints[j].time - start.time) / 1000 < 20) {
      j++;
    }
    end = trackPoints[j - 1];

    // If the bike moved less than 10 meters in the 20-second window, consider it a stop
    if (haversineDistance(start, end) < 10) {
      let stopStart = start;
      let stopEnd = end;

      // Continue checking 20-second windows until the bike moves more than 10 meters
      while (j < trackPoints.length && haversineDistance(stopEnd, trackPoints[j]) < 10) {
        stopEnd = trackPoints[j];
        j++;
      }

      // Append the total amount of seconds elapsed during the stop
      stops.push({
        start: stopStart.time,
        end: stopEnd.time,
        duration: (stopEnd.time - stopStart.time) / 1000,
        position: [stopStart.latitude, stopStart.longitude],
      });

      i = j;
    } else {
      i++;
    }
  }

  return stops.filter(o => o.duration > 60);
}


function haversineDistance(point1, point2) {
  const lat1 = point1.latitude;
  const lon1 = point1.longitude;
  const lat2 = point2.latitude;
  const lon2 = point2.longitude;
  return haversine({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 });
}
function formatDuration(duration) {
  var hours = Math.floor(duration / 3600);
  var minutes = Math.floor((duration % 3600) / 60);
  var seconds = duration % 60;

  var formattedHours = hours.toString().padStart(2, '0');
  var formattedMinutes = minutes.toString().padStart(2, '0');
  var formattedSeconds = seconds.toString().padStart(2, '0');

  return formattedHours + ':' + formattedMinutes + ':' + formattedSeconds;
}

function findCenterPoint(coordinates) {
  var totalLat = 0;
  var totalLng = 0;

  // Calculate the sum of latitude and longitude
  for (var i = 0; i < coordinates.length; i++) {
    totalLat += coordinates[i][0]; // Latitude
    totalLng += coordinates[i][1]; // Longitude
  }

  // Calculate the average latitude and longitude
  var avgLat = totalLat / coordinates.length;
  var avgLng = totalLng / coordinates.length;

  return [avgLat, avgLng]; // Return the center point as [latitude, longitude]
}