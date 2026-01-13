# Symphony Messenger API Documentation

## Overview

Symphony Messenger provides a comprehensive API for message dispatching, monitoring, and management. All API endpoints require authentication via Supabase Auth.

## Base URL

All API endpoints are prefixed with `/api/symphony`

## Authentication

All endpoints require user authentication via Supabase Auth. Unauthenticated requests will receive a `401 Unauthorized` response.

## Endpoints

### 1. Dispatch Message

**POST** `/api/symphony/dispatch`

Dispatch a message to the Symphony Messenger queue.

#### Request Body

```json
{
  "message": {
    "type": "EmailMessage",
    "payload": {
      "emailId": "email-123",
      "userId": "user-456",
      "mailboxId": "mailbox-789",
      "toEmail": "recipient@example.com",
      "subject": "Hello",
      "html": "<p>World</p>"
    },
    "metadata": {
      "userId": "user-456"
    }
  },
  "options": {
    "transport": "email",
    "queue": "default",
    "priority": 7,
    "scheduledAt": "2024-01-01T12:00:00Z",
    "idempotencyKey": "unique-key-123",
    "metadata": {
      "source": "api"
    },
    "headers": {
      "X-Custom-Header": "value"
    }
  }
}
```

#### Response

```json
{
  "success": true,
  "messageId": "uuid-here",
  "transport": "email",
  "queue": "default",
  "scheduledAt": "2024-01-01T12:00:00Z",
  "idempotencyKey": "unique-key-123"
}
```

#### Status Codes

- `201 Created` - Message dispatched successfully
- `400 Bad Request` - Invalid request body or validation error
- `401 Unauthorized` - Authentication required
- `500 Internal Server Error` - Server error

### 2. Consume Messages

**POST** `/api/symphony/consume`

Manually trigger message consumption (alternative to cron job).

#### Request Body (Optional)

```json
{
  "batchSize": 20,
  "maxConcurrency": 10,
  "timeLimit": 30000,
  "messageLimit": 100,
  "transport": "default"
}
```

#### Response

```json
{
  "success": true,
  "stats": {
    "totalProcessed": 15,
    "totalSucceeded": 14,
    "totalFailed": 1,
    "averageProcessingTime": 250.5,
    "currentQueueDepth": 5
  },
  "health": {
    "running": false,
    "processing": false,
    "uptime": 30000,
    "memoryUsage": 52428800
  }
}
```

### 3. Get Status

**GET** `/api/symphony/status?transport=default`

Get current status and health of Symphony Messenger system.

#### Query Parameters

- `transport` (optional) - Transport name (default: 'default')

#### Response

```json
{
  "success": true,
  "transport": "default",
  "queue": {
    "depth": 42,
    "pending": 35,
    "processing": 5,
    "completed": 1000,
    "failed": 2
  },
  "failedMessages": 2,
  "scheduledMessages": 10,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 4. Get Metrics

**GET** `/api/symphony/metrics?minutes=60&startTime=...&endTime=...`

Get message processing metrics.

#### Query Parameters

- `minutes` (optional) - Recent metrics in minutes (default: 60)
- `startTime` (optional) - Custom start time (ISO datetime)
- `endTime` (optional) - Custom end time (ISO datetime)

#### Response

```json
{
  "success": true,
  "metrics": {
    "startTime": "2024-01-01T11:00:00Z",
    "endTime": "2024-01-01T12:00:00Z",
    "totalProcessed": 1000,
    "totalSucceeded": 950,
    "totalFailed": 50,
    "averageProcessingTime": 250.5,
    "p50ProcessingTime": 200,
    "p95ProcessingTime": 500,
    "p99ProcessingTime": 1000,
    "successRate": 0.95,
    "failureRate": 0.05,
    "byMessageType": {
      "EmailMessage": {
        "total": 800,
        "succeeded": 760,
        "failed": 40,
        "averageTime": 200
      }
    },
    "byTransport": {
      "email": {
        "total": 800,
        "succeeded": 760,
        "failed": 40,
        "averageTime": 200
      }
    },
    "errors": {
      "Network error": 30,
      "Validation error": 20
    }
  }
}
```

### 5. Health Check

**GET** `/api/symphony/health?transport=default`

Get system health status.

#### Query Parameters

- `transport` (optional) - Transport name (default: 'default')

#### Response

```json
{
  "success": true,
  "health": {
    "status": "healthy",
    "checks": [
      {
        "name": "transport",
        "status": "healthy",
        "message": "Transport is accessible",
        "timestamp": "2024-01-01T12:00:00Z",
        "details": {
          "queueDepth": 42
        }
      },
      {
        "name": "error_rate",
        "status": "healthy",
        "message": "Error rate: 0.50%",
        "timestamp": "2024-01-01T12:00:00Z",
        "details": {
          "errorRate": 0.005
        }
      }
    ],
    "timestamp": "2024-01-01T12:00:00Z",
    "uptime": 3600000,
    "metrics": {
      "queueDepth": 42,
      "processingRate": 10.5,
      "errorRate": 0.005,
      "averageLatency": 250
    }
  }
}
```

#### Status Codes

- `200 OK` - Healthy or degraded
- `503 Service Unavailable` - Unhealthy

### 6. List Failed Messages

**GET** `/api/symphony/failed?transport=default&limit=50&offset=0`

List failed messages from dead letter queue.

#### Query Parameters

- `transport` (optional) - Transport name (default: 'default')
- `limit` (optional) - Number of messages to return (default: 50)
- `offset` (optional) - Pagination offset (default: 0)

#### Response

```json
{
  "success": true,
  "messages": [
    {
      "id": "uuid-here",
      "transport_name": "default",
      "queue_name": "default",
      "body": {
        "type": "EmailMessage",
        "payload": { ... }
      },
      "error": "Network error",
      "failed_at": "2024-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### 7. Retry Failed Message

**POST** `/api/symphony/failed/[id]/retry`

Retry a failed message by dispatching it again.

#### Response

```json
{
  "success": true,
  "message": "Failed message retried successfully",
  "newMessageId": "uuid-here",
  "originalFailedMessageId": "uuid-here"
}
```

### 8. Delete Failed Message

**DELETE** `/api/symphony/failed/[id]`

Delete a failed message from dead letter queue.

#### Response

```json
{
  "success": true,
  "message": "Failed message deleted successfully"
}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message",
  "details": "Additional error details (development only)"
}
```

## Rate Limiting

Currently, there are no rate limits on API endpoints. Consider implementing rate limiting for production use.

## Best Practices

1. **Use Idempotency Keys**: Always provide idempotency keys for critical messages
2. **Set Appropriate Priorities**: Use priority 7-10 for urgent messages, 1-3 for batch operations
3. **Monitor Health**: Regularly check health endpoint for system status
4. **Handle Errors**: Implement proper error handling for all API calls
5. **Use Metrics**: Monitor metrics to track system performance


