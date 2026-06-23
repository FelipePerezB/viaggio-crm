
# Project Blueprint

## Overview

This application is a CRM tool that processes customer and order data to provide insights into customer behavior, predict future purchases, and project stock needs. The application has been updated to connect directly to Google Sheets as a data source, allowing for a more streamlined and automated data pipeline.

## Features & Design

### Core Functionality
- **Google Sheets Integration:** Users can add multiple Google Sheet URLs as data sources. The application reads data from all sheets within each connected Google Sheet.
- **Connection Management:** Users can add and remove Google Sheet connections.
- **Data Processing:** The application processes the data to:
    - Calculate the days between purchases for each client.
    - Estimate the next purchase date.
    - Project stock levels for the next 30, 60, and 90 days.
    - Classify and profile shipping rates based on location.
- **Dashboard:** The main dashboard displays a list of clients with their contact information, last purchase date, and estimated next purchase date.
- **Interactive Actions:** Users can send WhatsApp messages to clients and view more detailed information.

### Styling & Design
- **Layout:** The application uses a clean, modern layout with a focus on readability and ease of use.
- **Components:** Interactive elements like buttons and input fields have a polished look with hover and active states.
- **Typography:** Clear and consistent typography is used to create a visual hierarchy.
- **Color Palette:** The color scheme is based on a palette of neutral grays with accents for interactive elements.

## Current Plan

The current development task is to replace the local Excel file upload with a system that connects to Google Sheets.

### Steps:
1.  **Create `blueprint.md`:** Document the application's architecture and the plan for the new feature.
2.  **Create `GoogleSheetManager.tsx`:** Develop a new component for managing Google Sheet connections (adding, removing, and reloading).
3.  **Update `page.tsx`:** Replace the existing `ExcelUploader` component with the new `GoogleSheetManager`.
4.  **Modify `extractData.ts`:** Update the data extraction logic to fetch and process data from Google Sheet URLs.
5.  **Remove `ExcelUploader.tsx`:** Delete the old component that is no longer needed.
