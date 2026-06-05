# eDC Invoice Builder

A Docker web app for creating monthly eDC service charge invoices.

## What the app does

The app lets you:

- Log in with email address and password.
- Select an invoice date range.
- Pull organisation usage data from eDC.
- Pull shipment data for organisations where `GetShipmentData = true`.
- Store API data in PostgreSQL.
- Warn when `OrganizationUsage_Read.ShipmentCount` does not match `Shipments_Read` count.
- Use `Shipments_Read` count for final invoice where `GetShipmentData = true`.
- Use `OrganizationUsage_Read.ShipmentCount` for normal customers.
- Manage organisations and charge rates in the admin section.
- Generate a multi-sheet Excel invoice.

## Technology

- Backend: Python FastAPI
- Frontend: React + Vite
- Database: PostgreSQL
- Deployment: Docker Compose
- Excel: openpyxl

## Folder structure

```text
backend/     Python FastAPI app
frontend/    React app
docs/        Design and iteration documents
```

## First time setup on Ubuntu VPS

### 1. Install Git

```bash
sudo apt update
sudo apt install -y git
```

### 2. Install Docker

```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Allow your user to run Docker without `sudo`:

```bash
sudo usermod -aG docker $USER
```

Log out and back in after this command.

### 3. Get the code onto Ubuntu

For first use, unzip the project on your computer, then upload it to GitHub.

Then on the VPS:

```bash
git clone https://github.com/YOUR-USERNAME/edc-invoice-builder.git
cd edc-invoice-builder
```

### 4. Create `.env`

```bash
cp .env.example .env
nano .env
```

Change these values:

```env
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql+psycopg2://edcuser:change_me@postgres:5432/edc_invoice
JWT_SECRET_KEY=make_this_long_and_random
INITIAL_ADMIN_EMAIL=your@email.com
INITIAL_ADMIN_PASSWORD=YourStrongPassword123!
EDC_USERNAME=your_edc_username
EDC_PASSWORD=your_edc_password
```

Save in nano:

```text
CTRL + O
ENTER
CTRL + X
```

### 5. Start the app

```bash
docker compose up -d --build
```

### 6. Open the app

In your browser:

```text
http://YOUR-SERVER-IP:3000
```

Backend health check:

```text
http://YOUR-SERVER-IP:8000/health
```

## Login

On first startup, the app creates the admin user from `.env`:

```env
INITIAL_ADMIN_EMAIL
INITIAL_ADMIN_PASSWORD
```

## Main workflow

1. Log in.
2. Select From Date and To Date.
3. Click `Collect Data`.
4. The backend creates a ProcessNumber.
5. The backend calls `OrganizationUsage_Read` using `PageSize = 100`.
6. New organisations are added to `tblOrganisations`.
7. For organisations where `GetShipmentData = true`, the backend calls `Shipments_Read` using `PageSize = 100`.
8. The app stores warnings in `tblInvoiceException`.
9. Review Usage, Shipment Data, and Warnings.
10. Click `Create Final Invoice`.
11. Click `Download Excel`.

## Important invoice rules

For normal organisations:

```text
Final count = OrganizationUsage_Read.ShipmentCount
```

For organisations where `GetShipmentData = true`:

```text
Final count = count of rows from Shipments_Read
```

`OrganizationUsage_Read.ShipmentCount` is only used as a warning check for those organisations.

## Basic Git commands

Check current status:

```bash
git status
```

Save your changes:

```bash
git add .
git commit -m "feat: update invoice builder"
git push
```

Get latest version onto Ubuntu:

```bash
git pull
```

Restart after changes:

```bash
docker compose up -d --build
```

## Useful Docker commands

Show running containers:

```bash
docker ps
```

Show logs:

```bash
docker compose logs -f
```

Restart app:

```bash
docker compose restart
```

Stop app:

```bash
docker compose down
```

## Current MVP limitations

- User management screen is not yet built.
- The admin screen is basic.
- CRUD for all tables is not fully completed yet.
- Invoice logic currently supports shipment-based charging first.
- Order and booking charging are planned for a future iteration.
