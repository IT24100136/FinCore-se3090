import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default Leaflet icon paths in Vite/React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function TransactionMap({ lat, lng, latitude, longitude, locationName = "Colombo, Sri Lanka" }) {
    const finalLat = Number(latitude ?? lat ?? 6.9271);
    const finalLng = Number(longitude ?? lng ?? 79.8612);
    return (
        <div style={{ height: '240px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
            <MapContainer key={`${finalLat}-${finalLng}`} center={[finalLat, finalLng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[finalLat, finalLng]}>
                    <Popup>
                        <strong>Originating Location</strong><br />
                        {locationName}
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}