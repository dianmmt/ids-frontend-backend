# SDN-IDS Main Functions and Descriptions

## Backend Services

### Database Service (`backend/services/database.js`)

#### **testConnection()**
- **Purpose**: Tests database connectivity and retrieves server information
- **Description**: Establishes connection, queries server time and PostgreSQL version
- **Returns**: Boolean indicating connection success
- **Usage**: Health checks and initialization

#### **initializeDatabase()**
- **Purpose**: Initializes database connection on application startup
- **Description**: Calls testConnection() and logs initialization status
- **Returns**: Promise resolving to success/failure
- **Usage**: Application bootstrap

#### **closeDatabase()**
- **Purpose**: Gracefully closes all database connections
- **Description**: Ends connection pool and handles cleanup
- **Returns**: Promise for cleanup completion
- **Usage**: Application shutdown

### Performance Service (`backend/services/performanceService.js`)

#### **calculateAndStoreSystemMetrics()**
- **Purpose**: Collects and stores system performance metrics
- **Description**: Gathers CPU, memory, disk, and network usage data
- **Returns**: Array of system metrics with status indicators
- **Usage**: Real-time system monitoring

#### **calculateCPUUsage()**
- **Purpose**: Calculates current CPU utilization percentage
- **Description**: Platform-specific CPU usage calculation (Windows/Linux)
- **Returns**: CPU usage percentage (0-100)
- **Usage**: System health monitoring

#### **calculateMemoryUsage()**
- **Purpose**: Calculates current memory utilization percentage
- **Description**: Platform-specific memory usage calculation
- **Returns**: Memory usage percentage (0-100)
- **Usage**: System health monitoring

#### **calculateDiskUsage()**
- **Purpose**: Calculates current disk space utilization
- **Description**: Platform-specific disk usage calculation
- **Returns**: Disk usage percentage (0-100)
- **Usage**: Storage monitoring

#### **calculateNetworkLoad()**
- **Purpose**: Calculates current network load percentage
- **Description**: Monitors network interface statistics
- **Returns**: Network load percentage (0-100)
- **Usage**: Network performance monitoring

#### **calculateAndStoreMLPerformance()**
- **Purpose**: Collects and stores ML model performance metrics
- **Description**: Tracks inference speed, accuracy, latency, and queue size
- **Returns**: ML performance metrics object
- **Usage**: ML system monitoring

#### **calculateAndStoreDatabasePerformance()**
- **Purpose**: Collects and stores database performance metrics
- **Description**: Monitors connections, query times, cache hit rates, and storage
- **Returns**: Database performance metrics object
- **Usage**: Database health monitoring

#### **calculateAndStoreNetworkStats()**
- **Purpose**: Collects and stores network statistics
- **Description**: Tracks packets per second, bandwidth, dropped packets, and active flows
- **Returns**: Network statistics object
- **Usage**: Network performance analysis

#### **calculateAndStoreSystemHealth()**
- **Purpose**: Calculates overall system health score
- **Description**: Aggregates all metrics to determine system status
- **Returns**: System health object with status and score
- **Usage**: System health dashboard

#### **collectAllPerformanceData()**
- **Purpose**: Main function to collect all performance data
- **Description**: Orchestrates collection of all performance metrics
- **Returns**: Summary of collection results
- **Usage**: Scheduled performance monitoring

### Attack Detection Service (`backend/routes/attacks.js`)

#### **handlePacketIn(packetData)**
- **Purpose**: Processes incoming packets for attack detection
- **Description**: Extracts packet info, runs ML prediction, stores attacks
- **Returns**: Void (side effects: database storage, SSE broadcast)
- **Usage**: Real-time attack detection

#### **handleFlowStats(flowData)**
- **Purpose**: Analyzes flow statistics for DDoS patterns
- **Description**: Detects high packet count with short duration patterns
- **Returns**: Void (side effects: attack detection and storage)
- **Usage**: Flow-based attack detection

#### **handlePortStats(portData)**
- **Purpose**: Analyzes port statistics for port scanning
- **Description**: Detects port scan patterns from port statistics
- **Returns**: Void (side effects: attack detection and storage)
- **Usage**: Port scan detection

#### **autoBlockAttack(packetInfo, attackData)**
- **Purpose**: Automatically blocks high-severity attacks
- **Description**: Sends block commands to Ryu controller for critical attacks
- **Returns**: Block operation result
- **Usage**: Automated threat response

#### **storeAndBroadcastAttack(attackData)**
- **Purpose**: Stores attack data and broadcasts to SSE clients
- **Description**: Database insertion and real-time notification
- **Returns**: Void (side effects: database storage, SSE broadcast)
- **Usage**: Attack event processing

## ML Services

### Multi-Class Inference Service (`ml/multi_class_inference_service.py`)

#### **load_ml_model()**
- **Purpose**: Loads ML model and preprocessing artifacts
- **Description**: Loads Random Forest model, scaler, and label encoder
- **Returns**: Boolean indicating success
- **Usage**: Service initialization

#### **preprocess_flow_data(flow_data)**
- **Purpose**: Preprocesses flow data for ML prediction
- **Description**: Maps CICFlowMeter features to model input format
- **Returns**: Preprocessed numpy array
- **Usage**: Data preparation for ML inference

#### **predict_attack_class(feature_array)**
- **Purpose**: Predicts attack class and returns probabilities
- **Description**: Runs ML model inference and maps results
- **Returns**: Tuple of (predicted_class, probabilities, confidence)
- **Usage**: Attack classification

#### **health_check()**
- **Purpose**: Provides service health status
- **Description**: Returns model status and configuration info
- **Returns**: Health status JSON
- **Usage**: Service monitoring

#### **model_info()**
- **Purpose**: Returns detailed model information
- **Description**: Provides model type, classes, and mappings
- **Returns**: Model metadata JSON
- **Usage**: Model management

#### **predict_single()**
- **Purpose**: Predicts for a single flow
- **Description**: HTTP endpoint for single flow prediction
- **Returns**: Prediction result JSON
- **Usage**: Real-time attack detection

#### **predict_batch()**
- **Purpose**: Predicts for multiple flows
- **Description**: HTTP endpoint for batch flow prediction
- **Returns**: Batch prediction results JSON
- **Usage**: Batch processing

#### **test_prediction()**
- **Purpose**: Tests prediction with sample data
- **Description**: Uses predefined sample flow for testing
- **Returns**: Test prediction result JSON
- **Usage**: Service testing and validation

## Frontend Components

### Attack Detection Component (`frontend/src/components/AttackDetection.tsx`)

#### **fetchActiveModels()**
- **Purpose**: Retrieves active ML models from backend
- **Description**: Fetches model list and filters active models
- **Returns**: Void (updates state)
- **Usage**: Model selection for attack detection

#### **testSelectedModel()**
- **Purpose**: Tests selected model with sample data
- **Description**: Sends test data to ML service and displays results
- **Returns**: Void (updates UI)
- **Usage**: Model validation

#### **fetchAttacks()**
- **Purpose**: Retrieves attack events from backend
- **Description**: Fetches attack data with filtering and pagination
- **Returns**: Void (updates state)
- **Usage**: Attack data display

#### **handleBlockAttack(attackId)**
- **Purpose**: Manually blocks a detected attack
- **Description**: Sends block request to backend and updates UI
- **Returns**: Void (updates state)
- **Usage**: Manual threat response

#### **handleSeverityFilter(severity)**
- **Purpose**: Filters attacks by severity level
- **Description**: Updates filter state and re-fetches data
- **Returns**: Void (updates state)
- **Usage**: Attack filtering

#### **handleSearch(searchTerm)**
- **Purpose**: Searches attacks by type or IP address
- **Description**: Updates search state and re-fetches data
- **Returns**: Void (updates state)
- **Usage**: Attack search functionality

#### **generateReport()**
- **Purpose**: Generates PDF report of attack data
- **Description**: Creates PDF with current attack data and charts
- **Returns**: Void (downloads PDF)
- **Usage**: Report generation

#### **exportToCSV()**
- **Purpose**: Exports attack data to CSV format
- **Description**: Converts attack data to CSV and triggers download
- **Returns**: Void (downloads CSV)
- **Usage**: Data export

### Model Management Component (`frontend/src/components/ModelManagement.tsx`)

#### **fetchModels()**
- **Purpose**: Retrieves all available models from backend
- **Description**: Fetches model list with metadata and performance metrics
- **Returns**: Void (updates state)
- **Usage**: Model list display

#### **handleFileUpload(files)**
- **Purpose**: Handles model file upload
- **Description**: Processes file selection and prepares for upload
- **Returns**: Void (updates state)
- **Usage**: Model upload functionality

#### **handleDragOver(e)**
- **Purpose**: Handles drag and drop over event
- **Description**: Updates UI state for drag feedback
- **Returns**: Void (updates state)
- **Usage**: Drag and drop interface

#### **handleDrop(e)**
- **Purpose**: Handles file drop event
- **Description**: Processes dropped files and updates form
- **Returns**: Void (updates state)
- **Usage**: Drag and drop file handling

#### **uploadModel()**
- **Purpose**: Uploads model files to backend
- **Description**: Sends model files and metadata to server
- **Returns**: Promise (updates state)
- **Usage**: Model upload process

#### **deleteModel(modelId)**
- **Purpose**: Deletes a model from the system
- **Description**: Sends delete request and refreshes model list
- **Returns**: Promise (updates state)
- **Usage**: Model removal

#### **activateModel(modelId)**
- **Purpose**: Activates a model for use
- **Description**: Sends activation request and updates model status
- **Returns**: Promise (updates state)
- **Usage**: Model activation

#### **deactivateModel(modelId)**
- **Purpose**: Deactivates a model
- **Description**: Sends deactivation request and updates model status
- **Returns**: Promise (updates state)
- **Usage**: Model deactivation

#### **downloadModel(modelId)**
- **Purpose**: Downloads model files
- **Description**: Triggers download of model files
- **Returns**: Void (downloads files)
- **Usage**: Model file retrieval

#### **filterModels(filter)**
- **Purpose**: Filters models by status
- **Description**: Updates filter state and re-renders model list
- **Returns**: Void (updates state)
- **Usage**: Model filtering

#### **sortModels(sortBy, sortOrder)**
- **Purpose**: Sorts models by specified criteria
- **Description**: Updates sort state and re-renders model list
- **Returns**: Void (updates state)
- **Usage**: Model sorting

#### **searchModels(searchTerm)**
- **Purpose**: Searches models by name or description
- **Description**: Updates search state and filters model list
- **Returns**: Void (updates state)
- **Usage**: Model search functionality

### Performance Monitor Component (`frontend/src/components/PerformanceMonitor.tsx`)

#### **fetchPerformanceData()**
- **Purpose**: Retrieves real-time performance metrics
- **Description**: Fetches system, ML, database, and network performance data
- **Returns**: Promise (updates state)
- **Usage**: Performance monitoring display

#### **refreshData()**
- **Purpose**: Manually refreshes performance data
- **Description**: Triggers data fetch and updates last refresh time
- **Returns**: Void (updates state)
- **Usage**: Manual data refresh

#### **formatBytes(bytes)**
- **Purpose**: Formats byte values for display
- **Description**: Converts bytes to human-readable format (KB, MB, GB)
- **Returns**: Formatted string
- **Usage**: Data display formatting

#### **getStatusColor(status)**
- **Purpose**: Returns color for status indicators
- **Description**: Maps status to appropriate color codes
- **Returns**: Color string
- **Usage**: UI status indication

#### **handleAlertAction(alertId, action)**
- **Purpose**: Handles alert actions (resolve, acknowledge)
- **Description**: Sends alert action request to backend
- **Returns**: Promise (updates state)
- **Usage**: Alert management

### Network Topology Component (`frontend/src/components/NetworkTopology.tsx`)

#### **loadTopologyData()**
- **Purpose**: Loads network topology from backend
- **Description**: Fetches network nodes and connections
- **Returns**: Promise (updates state)
- **Usage**: Topology visualization

#### **updateNodesFromTopology(topologyData)**
- **Purpose**: Updates node data from topology information
- **Description**: Processes topology data and updates node state
- **Returns**: Void (updates state)
- **Usage**: Topology data processing

#### **handleNodeClick(node)**
- **Purpose**: Handles node click events
- **Description**: Updates selected node and shows details
- **Returns**: Void (updates state)
- **Usage**: Node interaction

#### **handleNodeHover(node)**
- **Purpose**: Handles node hover events
- **Description**: Shows node information on hover
- **Returns**: Void (updates state)
- **Usage**: Node interaction feedback

#### **refreshTopology()**
- **Purpose**: Refreshes topology data
- **Description**: Reloads topology from backend
- **Returns**: Promise (updates state)
- **Usage**: Manual topology refresh

#### **exportTopology()**
- **Purpose**: Exports topology as image
- **Description**: Captures topology visualization as image
- **Returns**: Void (downloads image)
- **Usage**: Topology export

### User Management Component (`frontend/src/components/UserManagement.tsx`)

#### **fetchUsers()**
- **Purpose**: Retrieves user list from backend
- **Description**: Fetches all users with their roles and status
- **Returns**: Promise (updates state)
- **Usage**: User list display

#### **createUser(userData)**
- **Purpose**: Creates a new user
- **Description**: Sends user creation request to backend
- **Returns**: Promise (updates state)
- **Usage**: User creation

#### **updateUser(userId, userData)**
- **Purpose**: Updates existing user information
- **Description**: Sends user update request to backend
- **Returns**: Promise (updates state)
- **Usage**: User modification

#### **deleteUser(userId)**
- **Purpose**: Deletes a user
- **Description**: Sends user deletion request to backend
- **Returns**: Promise (updates state)
- **Usage**: User removal

#### **changeUserRole(userId, newRole)**
- **Purpose**: Changes user role
- **Description**: Updates user role and permissions
- **Returns**: Promise (updates state)
- **Usage**: Role management

#### **toggleUserStatus(userId)**
- **Purpose**: Toggles user active/inactive status
- **Description**: Activates or deactivates user account
- **Returns**: Promise (updates state)
- **Usage**: User status management

#### **resetUserPassword(userId)**
- **Purpose**: Resets user password
- **Description**: Generates new temporary password
- **Returns**: Promise (updates state)
- **Usage**: Password management

#### **searchUsers(searchTerm)**
- **Purpose**: Searches users by name or email
- **Description**: Filters user list based on search criteria
- **Returns**: Void (updates state)
- **Usage**: User search functionality

#### **filterUsersByRole(role)**
- **Purpose**: Filters users by role
- **Description**: Shows only users with specified role
- **Returns**: Void (updates state)
- **Usage**: User filtering

## API Routes

### Authentication Routes (`backend/routes/auth.js`)

#### **POST /api/auth/login**
- **Purpose**: User authentication
- **Description**: Validates credentials and returns JWT token
- **Returns**: Authentication response with token
- **Usage**: User login

#### **POST /api/auth/register**
- **Purpose**: User registration
- **Description**: Creates new user account
- **Returns**: Registration response
- **Usage**: User signup

#### **POST /api/auth/logout**
- **Purpose**: User logout
- **Description**: Invalidates user session
- **Returns**: Logout confirmation
- **Usage**: User logout

#### **GET /api/auth/profile**
- **Purpose**: Get user profile
- **Description**: Returns current user information
- **Returns**: User profile data
- **Usage**: Profile display

#### **PUT /api/auth/profile**
- **Purpose**: Update user profile
- **Description**: Updates user information
- **Returns**: Updated profile data
- **Usage**: Profile management

### Dashboard Routes (`backend/routes/dashboard.js`)

#### **GET /api/dashboard/summary**
- **Purpose**: Get dashboard summary data
- **Description**: Aggregates key metrics from multiple tables
- **Returns**: Dashboard summary object
- **Usage**: Dashboard display

### Topology Routes (`backend/routes/topology.js`)

#### **GET /api/topology**
- **Purpose**: Get network topology
- **Description**: Returns network nodes and connections
- **Returns**: Topology data object
- **Usage**: Network visualization

### Performance Routes (`backend/routes/performance.js`)

#### **GET /api/performance/realtime**
- **Purpose**: Get real-time performance data
- **Description**: Returns current performance metrics
- **Returns**: Performance data object
- **Usage**: Performance monitoring

#### **GET /api/performance/alerts**
- **Purpose**: Get performance alerts
- **Description**: Returns active performance alerts
- **Returns**: Alerts array
- **Usage**: Alert management

## Database Functions

### Database Schema Functions

#### **update_updated_at_column()**
- **Purpose**: Updates timestamp on record modification
- **Description**: Trigger function for automatic timestamp updates
- **Returns**: Updated record
- **Usage**: Automatic timestamp management

#### **cleanup_old_performance_data(days_to_keep)**
- **Purpose**: Cleans up old performance data
- **Description**: Removes performance data older than specified days
- **Returns**: Number of deleted records
- **Usage**: Data maintenance

#### **get_best_model_by_name(model_name)**
- **Purpose**: Gets best performing model by name
- **Description**: Returns highest accuracy model for given name
- **Returns**: Model record
- **Usage**: Model selection

#### **get_model_performance_stats()**
- **Purpose**: Gets model performance statistics
- **Description**: Returns aggregated model performance metrics
- **Returns**: Statistics object
- **Usage**: Model performance analysis

## Utility Functions

### Frontend Utilities

#### **formatDate(date)**
- **Purpose**: Formats dates for display
- **Description**: Converts timestamps to readable format
- **Returns**: Formatted date string
- **Usage**: Date display

#### **formatBytes(bytes)**
- **Purpose**: Formats byte values
- **Description**: Converts bytes to human-readable format
- **Returns**: Formatted string
- **Usage**: Size display

#### **getSeverityColor(severity)**
- **Purpose**: Gets color for severity levels
- **Description**: Maps severity to color codes
- **Returns**: Color string
- **Usage**: UI styling

#### **validateEmail(email)**
- **Purpose**: Validates email format
- **Description**: Checks email format validity
- **Returns**: Boolean
- **Usage**: Form validation

### Backend Utilities

#### **hashPassword(password)**
- **Purpose**: Hashes passwords securely
- **Description**: Uses bcrypt to hash passwords
- **Returns**: Hashed password
- **Usage**: Password security

#### **verifyPassword(password, hash)**
- **Purpose**: Verifies password against hash
- **Description**: Uses bcrypt to verify passwords
- **Returns**: Boolean
- **Usage**: Authentication

#### **generateJWT(payload)**
- **Purpose**: Generates JWT tokens
- **Description**: Creates signed JWT tokens
- **Returns**: JWT token string
- **Usage**: Authentication

#### **verifyJWT(token)**
- **Purpose**: Verifies JWT tokens
- **Description**: Validates and decodes JWT tokens
- **Returns**: Decoded payload
- **Usage**: Authentication

#### **sanitizeInput(input)**
- **Purpose**: Sanitizes user input
- **Description**: Removes potentially harmful characters
- **Returns**: Sanitized string
- **Usage**: Security

#### **validateIPAddress(ip)**
- **Purpose**: Validates IP address format
- **Description**: Checks IP address validity
- **Returns**: Boolean
- **Usage**: Network validation

This comprehensive list covers all the main functions across the SDN-IDS system, providing clear descriptions of their purposes, functionality, and usage contexts.


