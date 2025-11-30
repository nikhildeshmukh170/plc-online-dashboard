# PLC Online Dashboard

A complete real-time monitoring and control system for industrial PLC (Programmable Logic Controllers) with a modern web-based dashboard.

## 🎯 Features

✅ **Real-time PLC Data Monitoring** - Live data display from Modbus PLC  
✅ **Web-based Dashboard** - React frontend with responsive design  
✅ **Cloud Backend API** - Express.js server with MySQL database  
✅ **Local Modbus Bridge** - Connects to PLC via Modbus TCP/RTU  
✅ **Demo Mode** - Test without PLC hardware  
✅ **Data Editing** - Modify PLC values directly from dashboard  
✅ **Auto-refresh** - Real-time data updates  
✅ **Error Handling** - Robust error recovery and logging  

## 📁 Project Structure

```
plc-online-dashboard/
├── local_bridge/          # Modbus bridge to PLC
│   ├── bridge.js         # Main bridge logic
│   ├── package.json
│   ├── .env              # Configuration
│   └── node_modules/
├── cloud_api/            # Backend API server
│   ├── server.js         # Express app
│   ├── db.js             # Database connection
│   ├── package.json
│   ├── .env              # Database credentials
│   └── node_modules/
├── dashboard/            # React frontend
│   ├── src/
│   │   ├── api.js        # API integration
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── components/   # React components
│   │   └── styles.css
│   ├── package.json
│   ├── .env              # API URL config
│   └── node_modules/
└── SETUP.md              # Detailed setup guide
```

## 🚀 Quick Start

### Prerequisites
- Node.js v14+
- MySQL database
- npm or yarn

### 1. Clone and Install Dependencies

```bash
# Local Bridge
cd local_bridge && npm install

# Cloud API
cd cloud_api && npm install

# Dashboard
cd dashboard && npm install
```

### 2. Configure Environment

**Cloud API** - Create `cloud_api/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=plc_dashboard
```

**Local Bridge** - Edit `local_bridge/.env`:
```env
CLOUD_API_URL=http://localhost:5000/api/plc/update
DEMO=true
BRIDGE_POLL_SEC=5
```

**Dashboard** - Create `dashboard/.env`:
```env
REACT_APP_API_URL=http://localhost:5000
```

### 3. Setup Database

```sql
CREATE DATABASE plc_dashboard;
USE plc_dashboard;
CREATE TABLE plc_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tag VARCHAR(100) NOT NULL UNIQUE,
  value VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 4. Start All Services

**Terminal 1 - Cloud API:**
```bash
cd cloud_api && npm start
# Runs on http://localhost:5000
```

**Terminal 2 - Local Bridge:**
```bash
cd local_bridge && npm start
# Starts sending data to API
```

**Terminal 3 - Dashboard:**
```bash
cd dashboard && npm start
# Runs on http://localhost:3000
```

## 🎮 How to Use

1. Open dashboard: `http://localhost:3000`
2. View live PLC data in the table
3. Edit values by clicking the "Edit" button
4. Watch real-time updates (default: every 5 seconds)
5. Check logs in each terminal for details

## 🔧 Configuration

### Demo Mode (Default)
Test without PLC hardware:
```env
# local_bridge/.env
DEMO=true
```

### Production Mode (Real PLC)
Connect to actual PLC:
```env
# local_bridge/.env
DEMO=false
PLC_IP=192.168.0.10
PLC_PORT=502
```

### Add PLC Tags

Edit `TAG_CONFIG` in `bridge.js`:
```javascript
const TAG_CONFIG = [
  { tag: 'TEMP-01', address: 0, type: 'float', function: 'holding' },
  { tag: 'PUMP-01', address: 1, type: 'boolean', function: 'coil' },
  { tag: 'PRESSURE', address: 2, type: 'uint16', function: 'input' },
];
```

**Supported Types:**
- `float` - 32-bit floating point
- `uint16` - Unsigned integer
- `int16` - Signed integer
- `boolean` - Digital I/O

**Supported Functions:**
- `holding` - Holding registers
- `input` - Input registers
- `coil` - Output coils
- `discrete` - Discrete inputs

## 📊 Data Flow

```
PLC ──Modbus TCP──> Local Bridge ──HTTP POST──> Cloud API ──────┐
                                                      ↓           │
                                                  MySQL DB        │
                                                      ↑           │
Browser ──HTTP GET──> Dashboard ────HTTP GET────> Cloud API ◄────┘
                        (React)
```

## 🛠️ API Endpoints

### Get All PLC Data
```http
GET /api/plc/data
```
Response:
```json
[
  {
    "id": 1,
    "tag": "TEMP-01",
    "value": "45.67",
    "updated_at": "2025-11-21T10:30:45Z"
  }
]
```

### Update PLC Value
```http
POST /api/plc/update
Content-Type: application/json

{
  "tag": "TEMP-01",
  "value": 45.67
}
```

### Edit PLC Value
```http
PUT /api/plc/edit
Content-Type: application/json

{
  "tag": "TEMP-01",
  "value": 50.00
}
```

## 🐛 Troubleshooting

### Bridge can't connect to PLC
- Verify PLC IP and port in `.env`
- Check if PLC is powered on and reachable
- Try `DEMO=true` mode first

### "No PLC data available"
- Check if bridge is running: `npm start` in `local_bridge/`
- Wait a few seconds for initial data
- Check browser console for errors

### API returns database error
- Verify MySQL is running
- Check `.env` credentials in `cloud_api/`
- Ensure `plc_data` table exists

### Data not updating in dashboard
- Check all three services are running
- Verify firewall allows localhost connections
- Check browser console and terminal logs

## 📝 Environment Variables

### local_bridge/.env
| Variable | Default | Description |
|----------|---------|-------------|
| CLOUD_API_URL | http://localhost:5000/api/plc/update | API endpoint |
| PLC_IP | 192.168.0.10 | PLC host IP |
| PLC_PORT | 502 | Modbus port |
| DEMO | true | Demo mode |
| BRIDGE_POLL_SEC | 5 | Update interval |

### cloud_api/.env
| Variable | Description |
|----------|-------------|
| PORT | API port |
| DB_HOST | MySQL host |
| DB_USER | MySQL username |
| DB_PASSWORD | MySQL password |
| DB_NAME | Database name |
| DB_PORT | MySQL port |

### dashboard/.env
| Variable | Description |
|----------|-------------|
| REACT_APP_API_URL | Backend API URL |

## 📦 Dependencies

**Local Bridge:**
- axios - HTTP client
- modbus-serial - Modbus TCP/RTU
- dotenv - Environment config

**Cloud API:**
- express - Web framework
- mysql2 - Database driver
- cors - Cross-origin support

**Dashboard:**
- react - UI framework
- react-toastify - Notifications
- axios - HTTP client

## 🔒 Security Notes

- Never commit `.env` files with real credentials
- Use environment variables for sensitive data
- Implement authentication before production
- Use HTTPS in production
- Restrict API access with firewalls

## 📚 Additional Resources

- See [SETUP.md](./SETUP.md) for detailed setup instructions
- Check terminal logs for debug information
- Refer to component files for implementation details

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

ISC

---

**Status:** ✅ Fully Functional  
**Last Updated:** November 21, 2025