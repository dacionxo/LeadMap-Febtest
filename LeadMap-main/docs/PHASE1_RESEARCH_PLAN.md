# Phase 1: Research & Architecture Analysis Plan

## Overview
This document outlines the comprehensive research plan for Phase 1, which will inform the integration of nodemailer and james-project patterns into the LeadMap Unibox OAuth-enabled system.

## Research Objectives

### 1. james-project Codebase Analysis

#### 1.1 SMTP Implementation Study
- **File**: `james-project/protocols/smtp/src/main/java/org/apache/james/protocols/smtp/core/esmtp/AuthCmdHandler.java`
- **Focus Areas**:
  - OAuth2/XOAUTH2 authentication patterns
  - Message handling and routing
  - Connection management
  - Error handling and retry logic
  - Queue management
  - Message validation

#### 1.2 IMAP Implementation Study
- **File**: `james-project/protocols/imap/src/main/java/org/apache/james/imap/processor/AuthenticateProcessor.java`
- **Focus Areas**:
  - OAuth authentication (OAUTHBEARER, XOAUTH2)
  - IDLE support implementation
  - Folder management patterns
  - Message flags handling
  - Search capabilities
  - Connection state management

#### 1.3 Mailbox Management Study
- **Location**: `james-project/mailbox/`
- **Focus Areas**:
  - Multi-tenant mailbox handling
  - User management patterns
  - Quota enforcement
  - Message storage and retrieval
  - Threading algorithms
  - Search indexing

#### 1.4 OAuth/OIDC Patterns Study
- **Location**: `james-project/examples/oidc/`
- **Focus Areas**:
  - OAuth2 token validation
  - JWT verification patterns
  - OIDC SASL configuration
  - Token refresh strategies
  - Error recovery patterns

### 2. nodemailer Research

#### 2.1 OAuth2 Capabilities
- **Source**: Context7 documentation
- **Focus Areas**:
  - XOAUTH2 support for Gmail
  - XOAUTH2 support for Outlook
  - OAuth2 token handling
  - Connection pooling
  - Error recovery patterns
  - Token refresh mechanisms

#### 2.2 Integration Patterns
- Connection management
- Transporter reuse
- Error handling
- Retry logic
- Rate limiting

### 3. Current Unibox Implementation Analysis

#### 3.1 Gmail Connector Analysis
- **File**: `lib/email/unibox/gmail-connector.ts`
- **Gaps to Identify**:
  - OAuth handling issues
  - Error recovery gaps
  - Rate limiting problems
  - Threading algorithm issues
  - Token refresh failures

#### 3.2 Outlook Connector Analysis
- **File**: `lib/email/unibox/outlook-connector.ts`
- **Gaps to Identify**:
  - Token refresh issues
  - Error handling gaps
  - Microsoft Graph API integration problems
  - Message parsing issues

#### 3.3 IMAP Connector Analysis
- **File**: `lib/email/unibox/imap-connector.ts`
- **Gaps to Identify**:
  - Serverless compatibility issues
  - IDLE support gaps
  - Connection management problems
  - Folder synchronization issues

#### 3.4 OAuth Implementation Analysis
- **Files**: `lib/email/auth/*.ts`
- **Gaps to Identify**:
  - Token refresh failures
  - Scope management issues
  - Error handling gaps
  - State validation problems

#### 3.5 SMTP Provider Analysis
- **File**: `lib/email/providers/smtp.ts`
- **Gaps to Identify**:
  - nodemailer integration gaps
  - OAuth2 support issues
  - Connection management problems
  - Error handling gaps

### 4. Documentation Tasks

#### 4.1 james-project Pattern Documentation
- Document SMTP patterns for TypeScript adaptation
- Document IMAP patterns for TypeScript adaptation
- Document OAuth patterns for TypeScript adaptation
- Document mailbox management patterns

#### 4.2 nodemailer Integration Strategy
- Document nodemailer service wrapper architecture
- Document OAuth2 support patterns
- Document connection pooling strategy
- Document error handling patterns

#### 4.3 Architecture Document
- How james-project components inform TypeScript implementations
- nodemailer integration patterns
- OAuth enhancement strategy
- Integration roadmap

## Research Methodology

1. **Code Analysis**: Deep dive into james-project Java code to extract patterns
2. **Documentation Review**: Study james-project documentation and examples
3. **Context7 Research**: Use Context7 MCP tools for nodemailer documentation
4. **Current System Audit**: Analyze existing Unibox implementation for gaps
5. **Pattern Extraction**: Extract reusable patterns from james-project
6. **TypeScript Adaptation**: Document how to adapt Java patterns to TypeScript
7. **Architecture Design**: Create comprehensive architecture plan

## Deliverables

1. **james-project Pattern Analysis Document**
   - SMTP patterns
   - IMAP patterns
   - OAuth patterns
   - Mailbox management patterns

2. **nodemailer Integration Guide**
   - OAuth2 setup
   - Connection management
   - Error handling
   - Best practices

3. **Current System Gap Analysis**
   - Gmail connector gaps
   - Outlook connector gaps
   - IMAP connector gaps
   - OAuth implementation gaps
   - SMTP provider gaps

4. **Architecture Document**
   - Integration strategy
   - Component design
   - Data flow diagrams
   - Implementation roadmap

5. **TypeScript Adaptation Guide**
   - Java to TypeScript pattern mapping
   - Code examples
   - Best practices

## Success Criteria

- [ ] Complete analysis of james-project SMTP implementation
- [ ] Complete analysis of james-project IMAP implementation
- [ ] Complete analysis of james-project OAuth patterns
- [ ] Complete analysis of nodemailer OAuth2 capabilities
- [ ] Complete gap analysis of current Unibox implementation
- [ ] Comprehensive architecture document created
- [ ] Integration roadmap documented
- [ ] All patterns documented with TypeScript equivalents

## Timeline

- **Week 1**: james-project codebase analysis
- **Week 2**: nodemailer research and current system analysis
- **Week 3**: Documentation and architecture design

## Next Steps

After Phase 1 completion, proceed to Phase 2: nodemailer Integration Enhancement.


