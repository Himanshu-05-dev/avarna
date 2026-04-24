# YourCrawl - Backend Info & Status

## Overview
The Backend is a Node.js Express server that acts as an orchestration layer between the Frontend UI and the ML Microservice. Its primary responsibility is to handle user requests to audit a website, crawl the target website using Puppeteer, hand off the extracted DOM data to the ML Python service, and finally format the results into a human-readable Markdown report using Google Gemini.

## Current State & Features
- **Express Server**: Runs on port 3000 (`server.js`, `src/app/app.js`). Configured with large payload limits (`50mb`) to handle base64 screenshots.
- **Puppeteer Crawler (`crawl.service.js`)**: 
  - Navigates to a given URL.
  - Blocks heavy media resources to speed up execution.
  - Extracts interactive elements (`button`, `a`, `input`, etc.), their computed CSS (color, z-index, visibility), bounding boxes, and ARIA attributes.
  - Takes a full-page screenshot and saves it to the local `/screenshots` directory.
- **ML Handoff (`crawl.service.js`)**:
  - Sends the compiled DOM and screenshot data to the ML API (`http://127.0.0.1:8000/api/v1/scan`).
- **AI Report Generation (`ai.service.js`)**:
  - Uses `@langchain/google-genai` (`gemini-2.5-flash-lite`).
  - Cleans and deduplicates the raw ML scan result (grouping similar tickets by subtype).
  - Prompts Gemini to generate a structured, easy-to-read Markdown report containing an Executive Summary, Detected Patterns, Quick Wins, Regulatory Risk, and a Remediation Roadmap.
- **API Endpoints**:
  - `POST /api/crawl`: Main endpoint receiving `{ "url": "..." }`, orchestrating the crawl, and returning the Markdown report.

## Key Dependencies
- `puppeteer` & `puppeteer-core`: For headless browser crawling.
- `@langchain/google-genai` & `langchain`: For interacting with Gemini LLM.
- `express`, `morgan`: Web server and logging.
- `imagekit`: Likely intended for cloud image storage if screenshots are moved off the local disk.

## Status
Fully functional orchestration pipeline. Currently runs synchronously, meaning a crawl request blocks until the Puppeteer crawl, ML scan, and Gemini generation are complete.
