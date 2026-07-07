const toRadians = (degrees) => degrees * Math.PI / 180;

const distanceInKm = (fromLat, fromLng, toLat, toLng) => {
    const earthRadiusKm = 6371;
    const latDelta = toRadians(toLat - fromLat);
    const lngDelta = toRadians(toLng - fromLng);
    const a = Math.sin(latDelta / 2) ** 2
        + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat))
        * Math.sin(lngDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isAddressWithinServiceArea = (serviceArea, address) => {
    const providerCoordinates = serviceArea?.coordinates;
    const customerLat = Number(address?.coordinates?.lat);
    const customerLng = Number(address?.coordinates?.lng);
    const radiusInKm = Number(serviceArea?.radiusInKm);

    if (!Array.isArray(providerCoordinates) || providerCoordinates.length !== 2
        || !Number.isFinite(Number(providerCoordinates[0]))
        || !Number.isFinite(Number(providerCoordinates[1]))
        || !Number.isFinite(customerLat) || !Number.isFinite(customerLng)
        || !Number.isFinite(radiusInKm) || radiusInKm <= 0) {
        return false;
    }

    return distanceInKm(
        Number(providerCoordinates[1]),
        Number(providerCoordinates[0]),
        customerLat,
        customerLng
    ) <= radiusInKm;
};

module.exports = { distanceInKm, isAddressWithinServiceArea };
