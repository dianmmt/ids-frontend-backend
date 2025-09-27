# CICFlowMeter Integration Configuration

## Overview
The SDN-IDS backend now supports automatic detection and monitoring of CICFlowMeter files with timestamp-based naming patterns like `<timestamp>_Flow.csv`.

## Configuration Options

### Option 1: Directory Monitoring (Recommended for timestamp-based files)
Set these environment variables in your `.env` file:

```bash
# Directory where CICFlowMeter saves files
CICFLOWMETER_CSV_DIRECTORY=C:\path\to\cicflowmeter\output

# Pattern to match files (supports wildcards)
CICFLOWMETER_CSV_PATTERN=*_Flow.csv

# Optional tuning
CICFLOWMETER_BATCH_SIZE=100
CICFLOWMETER_POLL_INTERVAL=5000
```

### Option 2: Single File Monitoring (Original)
```bash
# Single CSV file path
CICFLOWMETER_CSV_PATH=/path/to/flows.csv
```

### Option 3: Socket Mode (Alternative)
```bash
# Backend listens on this socket for real-time data
CICFLOWMETER_SOCKET_HOST=0.0.0.0
CICFLOWMETER_SOCKET_PORT=9999
```

## How Directory Monitoring Works

1. **Pattern Matching**: The collector watches the specified directory for files matching the pattern (e.g., `*_Flow.csv`)
2. **Automatic Detection**: New files are automatically detected and added to monitoring
3. **Multi-file Support**: Can monitor multiple files simultaneously (useful for overlapping captures)
4. **Smart Processing**: Only processes files that are actively growing (modified in last 5 minutes)
5. **Fallback Checking**: Periodic checks ensure no new files are missed

## Example File Patterns Supported

- `*_Flow.csv` - Matches `2024-01-15_10-30-45_Flow.csv`
- `flows_*.csv` - Matches `flows_20240115.csv`
- `*_flows_*.csv` - Matches `capture_flows_2024.csv`

## Setup Instructions

1. **Configure CICFlowMeter** to output files to a specific directory with your desired naming pattern
2. **Set environment variables** in `backend/.env`:
   ```bash
   CICFLOWMETER_CSV_DIRECTORY=C:\your\cicflowmeter\output
   CICFLOWMETER_CSV_PATTERN=*_Flow.csv
   ```
3. **Start the backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```
4. **Verify integration**:
   ```bash
   curl http://localhost:3001/api/cicflowmeter/stats
   ```

## Monitoring Multiple Files

The collector intelligently handles multiple files:
- Monitors files modified in the last 5 minutes
- Automatically stops monitoring files that are no longer growing
- Processes each file independently to avoid duplicate data
- Maintains separate line counters for each file

## Troubleshooting

- **No files detected**: Check that `CICFLOWMETER_CSV_DIRECTORY` exists and contains files matching the pattern
- **Files not processed**: Ensure files are actively being written to (modified recently)
- **Pattern not matching**: Verify `CICFLOWMETER_CSV_PATTERN` uses correct wildcard syntax
- **Performance issues**: Adjust `CICFLOWMETER_BATCH_SIZE` and `CICFLOWMETER_POLL_INTERVAL`

## Logs

The collector provides detailed logging:
```
[CICFlowMeter] Monitoring directory: C:\output for pattern: *_Flow.csv
[CICFlowMeter] Found 3 existing files matching pattern
[CICFlowMeter] New file detected: 2024-01-15_10-30-45_Flow.csv
[CICFlowMeter] Adding file to monitoring: C:\output\2024-01-15_10-30-45_Flow.csv
```
