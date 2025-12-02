# WhatsApp ↔ Geneline-X AI Bridge

A production-ready Node.js TypeScript service that bridges WhatsApp messages to Geneline-X AI and relays responses back.

## Features

- ✅ **WhatsApp Integration** - Uses `whatsapp-web.js` with LocalAuth for persistent sessions
- ✅ **Geneline-X AI** - Connects to Geneline-X message endpoint with streaming support
- ✅ **Document Ingestion** - Upload PDFs to train the chatbot's knowledge base
- ✅ **Topic Restriction** - Configurable system prompt to restrict responses to specific topics (default: Sierra Leone public health)
- ✅ **Queue System** - In-memory FIFO queue with per-chat rate limiting
- ✅ **Retry Logic** - Exponential backoff for 429/5xx errors
- ✅ **Media Support** - Downloads and forwards media attachments
- ✅ **Admin API** - REST endpoints for management and monitoring
- ✅ **Structured Logging** - Winston-based logging with event types
- ✅ **TypeScript** - Full type safety and modern ES2020 features

## Prerequisites

- Node.js 18+ and npm
- WhatsApp account for pairing
- Geneline-X API credentials

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd whatsapp-geneline-bridge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your configuration:
   ```env
   GENELINE_HOST=https://message.geneline-x.net
   GENELINE_API_KEY=your-api-key-here
   GENELINE_CHATBOT_ID=your-chatbot-id-here
   ADMIN_API_KEY=your-admin-secret-here
   ```

## Usage

### Development Mode

Run with auto-reload:
```bash
npm run dev
```

### Production Mode

Build and run:
```bash
npm run build
npm start
```

### Initial Setup - WhatsApp Pairing

1. Start the service
2. Check the terminal for the QR code, or access:
   ```bash
   curl http://localhost:3000/qr
   ```
3. Scan the QR code with your WhatsApp mobile app
4. Once authenticated, the session is saved and persists across restarts

## API Endpoints

### Public Endpoints

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-12-02T00:00:00.000Z"
}
```

#### `GET /qr`
Get QR code for WhatsApp pairing (base64 PNG data URL).

**Response:**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "isReady": false
}
```

#### `GET /status`
Get bot connection status and queue metrics.

**Response:**
```json
{
  "success": true,
  "whatsapp": {
    "isReady": true,
    "clientInfo": {
      "pushname": "Bot Name",
      "platform": "android"
    }
  },
  "queue": {
    "totalQueued": 100,
    "totalProcessed": 95,
    "totalFailed": 2,
    "currentQueueLength": 3,
    "activeWorkers": 2
  }
}
```

### Admin Endpoints

All admin endpoints require authentication via `X-API-Key` header or `Authorization: Bearer` header.

#### `POST /send`
Send arbitrary message from bot.

**Headers:**
```
X-API-Key: your-admin-secret
```

**Body:**
```json
{
  "phone": "1234567890",
  "message": "Hello from bot!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "chatId": "1234567890@c.us"
}
```

#### `POST /session/clear`
Clear WhatsApp session (requires restart to re-authenticate).

**Headers:**
```
X-API-Key: your-admin-secret
```

**Response:**
```json
{
  "success": true,
  "message": "Session cleared successfully"
}
```

#### `GET /queue/stats`
Get detailed queue statistics.

**Headers:**
```
X-API-Key: your-admin-secret
```

#### `POST /queue/clear`
Clear all queued messages.

**Headers:**
```
X-API-Key: your-admin-secret
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | API server port | `3000` |
| `GENELINE_HOST` | Geneline-X API host | Required |
| `GENELINE_API_KEY` | Geneline-X API key | Required |
| `GENELINE_CHATBOT_ID` | Geneline-X chatbot ID | Required |
| `GENELINE_SYSTEM_PROMPT` | System instructions for AI (topic restriction) | Public health topics in Sierra Leone |
| `GENELINE_INGEST_HOST` | Optional separate host for ingestion API | Uses `GENELINE_HOST` |
| `INGEST_POLL_INTERVAL_MS` | Polling interval for job status (ms) | `5000` |
| `MAX_FILE_SIZE_MB` | Maximum allowed file size | `50` |
| `ALLOWED_FILE_TYPES` | Comma-separated MIME types | `application/pdf` |
| `WHATSAPP_CLIENT_ID` | WhatsApp client identifier | `main-bot` |
| `ALLOW_GROUP_MESSAGES` | Process group messages | `false` |
| `ADMIN_API_KEY` | Admin API authentication key | Required |
| `MAX_CONCURRENCY` | Max concurrent AI requests | `5` |
| `PER_CHAT_RATE_LIMIT_MS` | Min ms between messages per chat | `1000` |

## Topic Restriction

By default, this chatbot is configured to **only answer public health-related questions about Sierra Leone**. This ensures the bot stays focused on its intended purpose.

### How It Works

The system uses a **system prompt** that is sent with every message to the Geneline-X API. This prompt instructs the AI to:
- Only answer questions related to public health in Sierra Leone
- Cover topics like: diseases, vaccinations, healthcare facilities, maternal/child health, nutrition, sanitation, hygiene, and disease prevention
- Politely decline off-topic questions and encourage users to ask relevant questions

### Customizing the Topic Restriction

You can customize the system prompt by setting the `GENELINE_SYSTEM_PROMPT` environment variable in your `.env` file:

```env
GENELINE_SYSTEM_PROMPT="Your custom instructions here..."
```

**Examples:**

**General health assistant (no geographic restriction):**
```env
GENELINE_SYSTEM_PROMPT="You are a helpful health assistant. Answer questions about health, wellness, and medical topics. Be informative and supportive."
```

**Mental health focus:**
```env
GENELINE_SYSTEM_PROMPT="You are a mental health support assistant for Sierra Leone. Only answer questions related to mental health, emotional wellbeing, stress management, and psychological support services in Sierra Leone."
```

**Remove all restrictions:**
```env
GENELINE_SYSTEM_PROMPT=""
```

### Example Interactions

**✅ Accepted Topics (Public Health in Sierra Leone):**
- "What are the symptoms of malaria?"
- "Where can I get vaccinated in Freetown?"
- "How can I prevent cholera?"
- "What maternal health services are available?"

**❌ Declined Topics (Off-topic):**
- "What's the weather like today?"
- "Tell me a joke"
- "Who won the football match?"
- "What's the capital of France?"

When users ask off-topic questions, the bot will politely explain its purpose and encourage them to ask public health-related questions about Sierra Leone.

## Knowledge Base Management

You can upload documents (like PDFs) to train your chatbot and enhance its knowledge base. This allows the bot to answer questions based on the content of your uploaded documents.

### CLI Tool for Document Upload

The easiest way to upload documents is using the built-in CLI tool.

#### Upload a PDF File

```bash
npm run ingest file ./path/to/document.pdf
```

**With metadata:**
```bash
npm run ingest file ./Standard-Treatment-Guidelines_Sierra-Leone-2021-Edition.pdf \
  --title "Standard Treatment Guidelines for Sierra Leone 2021" \
  --description "Official medical treatment guidelines" \
  --category "medical-guidelines"
```

**Upload without waiting for completion:**
```bash
npm run ingest file ./document.pdf --no-wait
```

#### Ingest from URL

```bash
npm run ingest url https://example.com/document.pdf \
  --title "Document Title" \
  --description "Document description"
```

#### Check Job Status

```bash
npm run ingest status <job-id>
```

#### List All Ingestion Jobs

```bash
npm run ingest list
```

> [!IMPORTANT]
> **File Size Limitations**: The Geneline-X API may have upload size limits (typically around 2-5MB for direct uploads). For larger files like the Sierra Leone Treatment Guidelines (5.49 MB), it's recommended to use **URL-based ingestion** instead of direct file upload. Host your PDF on a web server and use the `npm run ingest url` command.

### Admin API Endpoints for Ingestion

All ingestion endpoints require admin authentication via `X-API-Key` header.

#### `POST /admin/ingest/file`
Upload a PDF file for ingestion.

**Headers:**
```
X-API-Key: your-admin-secret
Content-Type: multipart/form-data
```

**Body (form-data):**
- `file` (file): The PDF file to upload
- `title` (string, optional): Document title
- `description` (string, optional): Document description
- `category` (string, optional): Document category

**Example with curl:**
```bash
curl -X POST http://localhost:3000/admin/ingest/file \
  -H "X-API-Key: your-admin-secret" \
  -F "file=@./Standard-Treatment-Guidelines_Sierra-Leone-2021-Edition.pdf" \
  -F "title=Standard Treatment Guidelines for Sierra Leone 2021" \
  -F "description=Official medical treatment guidelines" \
  -F "category=medical-guidelines"
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-123-456",
  "message": "File upload initiated",
  "status": "pending"
}
```

#### `POST /admin/ingest/url`
Ingest a document from a URL.

**Headers:**
```
X-API-Key: your-admin-secret
Content-Type: application/json
```

**Body:**
```json
{
  "url": "https://example.com/document.pdf",
  "title": "Document Title",
  "description": "Document description",
  "category": "category-name"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-123-456",
  "message": "URL ingestion initiated",
  "status": "pending"
}
```

#### `GET /admin/ingest/status/:jobId`
Check the status of an ingestion job.

**Headers:**
```
X-API-Key: your-admin-secret
```

**Response:**
```json
{
  "success": true,
  "status": {
    "jobId": "job-123-456",
    "status": "completed",
    "progress": 100,
    "message": "Document successfully ingested",
    "createdAt": "2025-12-02T16:00:00.000Z",
    "updatedAt": "2025-12-02T16:05:00.000Z",
    "completedAt": "2025-12-02T16:05:00.000Z"
  }
}
```

#### `GET /admin/ingest/jobs`
List all ingestion jobs.

**Headers:**
```
X-API-Key: your-admin-secret
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "job-123-456",
      "status": "completed",
      "createdAt": "2025-12-02T16:00:00.000Z",
      "completedAt": "2025-12-02T16:05:00.000Z"
    }
  ],
  "total": 1
}
```

### Example: Uploading Sierra Leone Treatment Guidelines

```bash
# Navigate to project directory
cd whatsapp-geneline-bridge

# Upload the PDF using the CLI tool
npm run ingest file ./Standard-Treatment-Guidelines_Sierra-Leone-2021-Edition.pdf \
  --title "Standard Treatment Guidelines for Sierra Leone 2021 Edition" \
  --description "Comprehensive medical treatment guidelines for healthcare providers in Sierra Leone" \
  --category "medical-guidelines"

# The tool will show progress and wait for completion
# Once complete, your chatbot can answer questions based on the document!
```

### Configuration

Ingestion-related environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `GENELINE_INGEST_HOST` | Optional separate host for ingestion API | Uses `GENELINE_HOST` |
| `INGEST_POLL_INTERVAL_MS` | Polling interval for job status (ms) | `5000` |
| `MAX_FILE_SIZE_MB` | Maximum allowed file size | `50` |
| `ALLOWED_FILE_TYPES` | Comma-separated MIME types | `application/pdf` |


## How It Works

1. **Message Reception**: WhatsApp client receives a message
2. **Filtering**: Groups are filtered (unless enabled)
3. **Media Download**: If message has media, it's downloaded and converted to base64
4. **Queueing**: Message is added to per-chat FIFO queue
5. **Rate Limiting**: Queue enforces rate limits before processing
6. **AI Request**: Worker builds request and calls Geneline-X API
7. **Streaming**: Response is streamed and buffered
8. **Retry Logic**: Failed requests retry with exponential backoff
9. **Response**: AI response is sent back to WhatsApp chat

## Architecture

```
┌─────────────┐
│  WhatsApp   │
│   Client    │
└──────┬──────┘
       │ message event
       ▼
┌─────────────┐
│   Message   │
│   Handler   │
└──────┬──────┘
       │ enqueue
       ▼
┌─────────────┐
│    Queue    │
│   Manager   │
└──────┬──────┘
       │ process
       ▼
┌─────────────┐      ┌─────────────┐
│   Message   │─────▶│  Geneline-X │
│   Worker    │◀─────│  API Client │
└──────┬──────┘      └─────────────┘
       │ response
       ▼
┌─────────────┐
│  WhatsApp   │
│   Client    │
└─────────────┘
```

## Logging

The service uses structured logging with Winston. Log events include:

- `incoming_message` - WhatsApp message received
- `ai_request_sent` - Request sent to Geneline-X
- `ai_response_received` - Response received from Geneline-X
- `whatsapp_sent` - Message sent back to WhatsApp
- `error` - Error occurred

Logs are output to console in development (colorized) and JSON in production.

## Limitations

- **In-Memory Queue**: Queue state is lost on restart (no Redis/BullMQ)
- **No Database**: Message history is not persisted
- **No Docker**: Manual deployment required
- **Single Instance**: Cannot horizontally scale without Redis

## Troubleshooting

### QR Code Not Appearing
- Wait a few seconds after starting the service
- Check logs for errors
- Try accessing `/qr` endpoint

### Messages Not Processing
- Check `/status` endpoint for queue metrics
- Verify Geneline-X credentials in `.env`
- Check logs for API errors

### Session Lost
- LocalAuth data is stored in `.wwebjs_auth/` directory
- Don't delete this directory
- If lost, re-scan QR code

### Document Ingestion Failing
- Verify Geneline-X API credentials are correct
- Check file size doesn't exceed `MAX_FILE_SIZE_MB`
- Ensure file type is in `ALLOWED_FILE_TYPES`
- Check job status with `npm run ingest status <job-id>`
- Review logs for detailed error messages
- **HTTP 413 Error**: File too large for direct upload - use URL-based ingestion instead

### Job Status Shows "Failed"
- Check the error message in the job status response
- Verify the PDF file is not corrupted
- Ensure sufficient permissions for Geneline-X API
- Try re-uploading with different metadata

## Development

### Project Structure
```
src/
├── config/         # Environment configuration
├── whatsapp/       # WhatsApp client and handlers
├── geneline/       # Geneline-X API client and ingestion
├── queue/          # Queue manager and worker
├── api/            # Express server and routes
├── cli/            # CLI tools for ingestion
├── utils/          # Logger, rate limiter, and file processor
└── index.ts        # Main entry point
```

### Building
```bash
npm run build
```

Output is in `dist/` directory.

### Cleaning
```bash
npm run clean
```

## License

MIT

## Support

For issues or questions, please check the logs first. Most issues are related to:
- Missing or incorrect environment variables
- Network connectivity to Geneline-X
- WhatsApp session authentication
