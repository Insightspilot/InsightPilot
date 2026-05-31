# Database Schema Documentation

## Overview

This document describes the database schema extracted from the entity-relationship diagram. The schema supports a dashboard/analytics platform with data models, questions, collections, users, and access control.

---

## Tables

### COLLECTIONS
Stores top-level organizational groupings.

| Column | Key | Description |
|--------|-----|-------------|
| COLLECTIONID | PK | Primary key |
| NAME | | Collection name |
| DESCRIPTION | | Collection description |
| USERID | FK | Reference to USERS |
| CREATED_AT | | Timestamp of creation |
| UPDATED_AT | | Timestamp of last update |

---

### DASHBOARDS
Represents dashboard entities belonging to collections.

| Column | Key | Description |
|--------|-----|-------------|
| DASHBOARDID | PK | Primary key |
| NAME | | Dashboard name |
| DESCRIPTION | | Dashboard description |
| COLLECTIONID | FK | Reference to COLLECTIONS |
| USERID | FK | Reference to USERS |
| CREATED_AT | | Timestamp of creation |
| UPDATED_AT | | Timestamp of last update |

---

### DASHBOARD_CARD
Cards placed on dashboards, linked to questions.

| Column | Key | Description |
|--------|-----|-------------|
| ID | PK | Primary key |
| DASHBOARDID | FK | Reference to DASHBOARDS |
| TYPE (NOTNULL) | | Card type |
| QUESTIONID | FK | Reference to QUESTIONS |
| FILTER | | Filter settings |
| START_X | | X position on dashboard |
| START_Y | | Y position on dashboard |
| SIZE_X | | Width of card |
| SIZE_Y | | Height of card |
| CREATED_AT | | Timestamp of creation |
| UPDATED_AT | | Timestamp of last update |

---

### QUESTIONS
Represents saved queries/questions used in dashboard cards.

| Column | Key | Description |
|--------|-----|-------------|
| QUESTIONID | PK | Primary key |
| NAME | | Question name |
| DESCRIPTION | | Question description |
| MODALID | FK | Modal reference |
| USERID | FK | Reference to USERS |
| QUERY_JSONINB | | Query stored as JSON |
| VIEW_TYPE | | Type of visualization |
| VIEW_SETTING_JSONINB | | View settings as JSON |
| QUERY_TYPE | | Type of query |
| CREATED_AT | | Timestamp of creation |
| UPDATED_AT | | Timestamp of last update |
| COLLECTIONID | FK | Reference to COLLECTIONS |
| TAGID | FK | Reference to TAG |

---

### TEXTS
Rich text content blocks associated with dashboard cards.

| Column | Key | Description |
|--------|-----|-------------|
| TEXTID | PK | Primary key |
| DASHBOARDID | FK | Reference to DASHBOARDS |
| HEADING | | Text heading |
| CONTENT | | Text content |
| FILTERID | FK | Reference to FILTERS |
| USERID | FK | Reference to USERS |
| CREATED_AT | | Timestamp of creation |
| UPDATED_AT | | Timestamp of last update |

---

### FILTERS
Defines filter configurations.

| Column | Key | Description |
|--------|-----|-------------|
| FILTERID | PK | Primary key |
| OWNER | | Owner of the filter |
| CREATED_AT | | Timestamp of creation |
| UPDATED_AT | | Timestamp of last update |

---

### DATA_MODEL
Represents data models (tables/views) available in the platform.

| Column | Key | Description |
|--------|-----|-------------|
| MODELID | PK | Primary key |
| DATAGROUPID | FK | Reference to DATA_GROUPS |
| NAME | | Model name |
| DESCRIPTION | | Model description |
| TABLE_NAME | | Underlying table name |
| TAGID | FK | Reference to TAG |
| CREATED_AT | | Timestamp of creation |

---

### DATA_GROUPS
Groups of data models.

| Column | Key | Description |
|--------|-----|-------------|
| DATAGROUPID | PK | Primary key |
| DESCRIPTION | | Group description |
| NAME | | Group name |
| CREATED_AT | | Timestamp of creation |
| UPDATED_AT | | Timestamp of last update |

---

### DATA_MODEL_ACCESS
Controls which users/emails have access to specific data models.

| Column | Key | Description |
|--------|-----|-------------|
| ID | PK | Primary key |
| EMAILID | FK | Reference to USERS (email) |
| DATAGROUPID | FK | Reference to DATA_GROUPS |
| CREATED_AT | | Timestamp of creation |

---

### TAG
Tags for categorizing data models and questions.

| Column | Key | Description |
|--------|-----|-------------|
| TAGID | PK | Primary key |
| TAGNAME | | Name of the tag |
| DESCRIPTION | | Tag description |
| CREATED_AT | | Timestamp of creation |
| UPDATED_AT | | Timestamp of last update |

---

### USERS
Platform user accounts.

| Column | Key | Description |
|--------|-----|-------------|
| EMAILID | PK | Primary key (email-based) |
| NAME | | Full name |
| DEPARTMENT | | User's department |
| CODE1 | | User code |
| CREATED_AT | | Timestamp of creation |
| ROLE (ADMIN/USER) | | Role of the user |
| MANAGER | | Manager reference |
| DESIGNATION | | Job designation |

---

### USER_INTERESTED_TAGS
Maps users to their tags of interest.

| Column | Key | Description |
|--------|-----|-------------|
| ID | PK | Primary key |
| EMAILID | FK | Reference to USERS |
| TAGID | FK | Reference to TAG |
| CREATED_AT | | Timestamp of creation |

---

### USER_DASHBOARD_ACCESS
Controls which users have access to which dashboards and at what permission level.

| Column | Key | Description |
|--------|-----|-------------|
| ID | PK | Primary key |
| EMAILID | FK | Reference to USERS |
| DASHBOARDID | FK | Reference to DASHBOARDS |
| PERMISSION_LEVEL | | Access level granted |
| CREATED_AT | | Timestamp of creation |
| UPDATED_AT | | Timestamp of last update |

---

### ORG
Organization-level entity.

| Column | Key | Description |
|--------|-----|-------------|
| EMAILID | PK | Primary key |
| NAME | | Organization name |
| CREATED_AT | | Timestamp of creation |

---

## Relationships Summary

| From Table | Foreign Key | To Table | Relationship |
|------------|-------------|----------|--------------|
| COLLECTIONS | USERID | USERS | Many-to-One |
| DASHBOARDS | COLLECTIONID | COLLECTIONS | Many-to-One |
| DASHBOARDS | USERID | USERS | Many-to-One |
| DASHBOARD_CARD | DASHBOARDID | DASHBOARDS | Many-to-One |
| DASHBOARD_CARD | QUESTIONID | QUESTIONS | Many-to-One |
| QUESTIONS | USERID | USERS | Many-to-One |
| QUESTIONS | COLLECTIONID | COLLECTIONS | Many-to-One |
| QUESTIONS | TAGID | TAG | Many-to-One |
| TEXTS | DASHBOARDID | DASHBOARDS | Many-to-One |
| TEXTS | FILTERID | FILTERS | Many-to-One |
| TEXTS | USERID | USERS | Many-to-One |
| DATA_MODEL | DATAGROUPID | DATA_GROUPS | Many-to-One |
| DATA_MODEL | TAGID | TAG | Many-to-One |
| DATA_MODEL_ACCESS | EMAILID | USERS | Many-to-One |
| DATA_MODEL_ACCESS | DATAGROUPID | DATA_GROUPS | Many-to-One |
| USER_INTERESTED_TAGS | EMAILID | USERS | Many-to-One |
| USER_INTERESTED_TAGS | TAGID | TAG | Many-to-One |
| USER_DASHBOARD_ACCESS | EMAILID | USERS | Many-to-One |
| USER_DASHBOARD_ACCESS | DASHBOARDID | DASHBOARDS | Many-to-One |