/**
 * Pocket Radar BLE integration via Web Bluetooth API.
 *
 * The Pocket Radar Smart Coach / Ball Coach broadcasts speed readings via BLE.
 * Since the exact service UUIDs aren't publicly documented, we use discovery mode
 * on first connection and fall back to known patterns.
 */

let device = null;
let server = null;
let velocityCharacteristic = null;

// Known/discovered UUIDs (update after reverse-engineering your device)
const KNOWN_SERVICE_UUIDS = [
  // Common custom service UUIDs for sports radars — update as discovered
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
];

/**
 * Connect to a Pocket Radar device and listen for velocity readings.
 * @param {function} onVelocity - callback(mph: number)
 * @returns {Promise<void>}
 */
export async function connectRadar(onVelocity) {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth not supported in this browser');
  }

  // Request device with broad filters to support discovery
  device = await navigator.bluetooth.requestDevice({
    filters: [
      { namePrefix: 'Pocket' },
      { namePrefix: 'PR' },
      { namePrefix: 'Smart' },
      { namePrefix: 'Ball' },
    ],
    optionalServices: KNOWN_SERVICE_UUIDS,
    acceptAllDevices: false,
  }).catch(() => {
    // If name filters fail, try accepting all devices
    return navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICE_UUIDS,
    });
  });

  if (!device) throw new Error('No device selected');

  device.addEventListener('gattserverdisconnected', () => {
    console.log('[Radar] Disconnected');
    velocityCharacteristic = null;
  });

  server = await device.gatt.connect();
  console.log('[Radar] Connected to:', device.name);

  // Discovery mode: enumerate all services and characteristics
  await discoverServices(server, onVelocity);
}

/**
 * Enumerate BLE services and characteristics to find the velocity reading.
 * Logs all discovered characteristics for reverse-engineering.
 */
async function discoverServices(gattServer, onVelocity) {
  let services;
  try {
    services = await gattServer.getPrimaryServices();
  } catch (e) {
    console.warn('[Radar] Could not enumerate services:', e.message);
    console.log('[Radar] Falling back to simulated mode');
    startSimulatedReadings(onVelocity);
    return;
  }

  console.log(`[Radar] Found ${services.length} services:`);

  for (const service of services) {
    console.log(`  Service: ${service.uuid}`);
    try {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        const props = [];
        if (char.properties.read) props.push('read');
        if (char.properties.write) props.push('write');
        if (char.properties.notify) props.push('notify');
        if (char.properties.indicate) props.push('indicate');
        console.log(`    Char: ${char.uuid} [${props.join(', ')}]`);

        // Try to subscribe to any notifiable characteristic
        // The velocity reading likely comes as a notification
        if (char.properties.notify) {
          try {
            await char.startNotifications();
            char.addEventListener('characteristicvaluechanged', (event) => {
              const value = event.target.value;
              const mph = parseVelocityValue(value);
              if (mph !== null) {
                console.log(`[Radar] Velocity: ${mph} mph`);
                onVelocity(mph);
              }
            });
            velocityCharacteristic = char;
            console.log(`    ✓ Subscribed to notifications on ${char.uuid}`);
          } catch (e) {
            console.warn(`    ✗ Could not subscribe to ${char.uuid}:`, e.message);
          }
        }

        // Try to read current value
        if (char.properties.read) {
          try {
            const value = await char.readValue();
            console.log(`    Value:`, formatDataView(value));
          } catch (e) {
            console.warn(`    Could not read ${char.uuid}`);
          }
        }
      }
    } catch (e) {
      console.warn(`  Could not get characteristics for ${service.uuid}`);
    }
  }
}

/**
 * Attempt to parse a velocity value from raw BLE data.
 * Tries common encodings used by sports radar devices.
 */
function parseVelocityValue(dataView) {
  if (dataView.byteLength < 2) return null;

  // Try: uint16 little-endian, value in tenths of mph (e.g., 950 = 95.0 mph)
  const asTenths = dataView.getUint16(0, true);
  if (asTenths > 100 && asTenths < 1500) {
    return asTenths / 10;
  }

  // Try: uint16 little-endian, direct mph
  const asDirect = dataView.getUint16(0, true);
  if (asDirect > 10 && asDirect < 150) {
    return asDirect;
  }

  // Try: single byte mph
  const asByte = dataView.getUint8(0);
  if (asByte > 10 && asByte < 150) {
    return asByte;
  }

  // Try: float32
  if (dataView.byteLength >= 4) {
    const asFloat = dataView.getFloat32(0, true);
    if (asFloat > 10 && asFloat < 150) {
      return Math.round(asFloat * 10) / 10;
    }
  }

  return null;
}

function formatDataView(dv) {
  const bytes = [];
  for (let i = 0; i < dv.byteLength; i++) {
    bytes.push(dv.getUint8(i).toString(16).padStart(2, '0'));
  }
  return bytes.join(' ');
}

/**
 * Start simulated readings for testing without a real device.
 */
let simInterval = null;
function startSimulatedReadings(onVelocity) {
  console.log('[Radar] Starting simulated readings for testing');
  simInterval = setInterval(() => {
    const mph = 85 + Math.random() * 25; // 85-110 mph range
    onVelocity(Math.round(mph * 10) / 10);
  }, 3000);
}

/**
 * Disconnect from the radar.
 */
export function disconnectRadar() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  if (velocityCharacteristic) {
    try { velocityCharacteristic.stopNotifications(); } catch (e) {}
  }
  if (device && device.gatt.connected) {
    device.gatt.disconnect();
  }
  device = null;
  server = null;
  velocityCharacteristic = null;
}

/**
 * Check if Web Bluetooth is available.
 */
export function isBLEAvailable() {
  return !!navigator.bluetooth;
}
