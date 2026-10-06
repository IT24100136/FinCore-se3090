# FinCore-se3090

AI-powered transaction risk evaluation and analyst review application developed by **SEF_KDY_AI_09** for **SE3090 — Software Engineering Frameworks**, SLIIT.

FinCore connects a Flutter customer application, React staff portal, ASP.NET Core API, PostgreSQL database and an internal Python/FastAPI agent subsystem. Wallet funding and transfers are simulated; the application does not process live bank payments.

## Application and Submission Links

| Resource | Link |
|---|---|
| Source repository | [GitHub](https://github.com/IT24100136/FinCore-se3090) |
| Staff portal | [React application](https://fin-core-se3090.vercel.app/login) |
| Backend API | [API](https://fincore-se3090.onrender.com/) |
| Health endpoint | [Health](https://fincore-se3090.onrender.com/health) |
| API documentation | [Swagger](https://fincore-se3090.onrender.com/swagger) |
| Agent service | [FastAPI service](https://fincore-se3090-1.onrender.com) |
| Android APK | [APK folder](https://drive.google.com/drive/folders/1P58odnLK5QMMFfbsgEZG0cysLLvCtkfJ?usp=sharing) |
| Demonstration video | [Demo folder](https://drive.google.com/drive/folders/1-o0PdI75wuYj93swZ-GQ6zk9fNMJ8xW4?usp=sharing) |

Links are supplied in the final report. Availability and download permissions depend on the hosting and sharing configuration.

## Features and Ownership

| Component | Main responsibilities | Agent |
|---|---|---|
| A — Wallet and Transaction Core | Balances, simulated top-ups, transfers, history, status and authorized reversals | Transaction-Analysis Agent |
| B — Fraud Scoring and Rules Engine | Risk assessment, rule configuration, fraud flags and risk explanations | Anomaly-Detection Agent |
| C — Analyst Review and Case Management | Review queue, assignment, decisions, independent second approval, escalation and audit history | Approval-Coordinator Agent |
| D — Device Trust and Customer Communication | Device-related risk signals, identity features and email OTP verification | Tool-Use Agent |

Shared authentication and integration work is detailed in the individual contribution statements.

## Access and Login

Customers use the Flutter application. Create a customer account using an email address you can access, as the OTP required for login is sent to that address through Brevo.

Analysts and administrators use the React portal with authorized staff accounts. Staff credentials should be supplied privately to assessors rather than published in this repository.

## System Workflow

1. A customer submits a transfer through Flutter.
2. The backend validates the request and coordinates risk evaluation with the internal agents.
3. The evaluation routes the transaction to processing, additional verification or human review.
4. Authorized staff assign, investigate and decide held cases through React.
5. High-value transactions follow the configured dual-approval policy, requiring different approvers.
6. The backend stores decisions and coordinates settlement or rejection with the wallet component.
7. Customers can view the resulting transaction status.

React and Flutter communicate with the ASP.NET Core API. Agent coordination occurs through backend integration. Case assignments, escalation reasons and decisions are stored in PostgreSQL to support continuity after backend restarts.

## Technology

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core and Entity Framework Core |
| Database | PostgreSQL |
| Staff portal | React and Vite |
| Customer application | Flutter and Dart |
| Agent subsystem | Python and FastAPI |
| Email OTP | Brevo |
| Analyst maps | Leaflet and OpenStreetMap |
| CI | GitHub Actions |

Use the SDK and dependency versions declared in the repository. State-management and orchestration packages should be verified against source code rather than inferred from the report.

## Local Setup

The source repository is not included with this README attachment. Confirm directory names, startup modules and project paths against the checkout before running the commands below.

### Prerequisites

Install Git, the required .NET SDK, PostgreSQL, Node.js/npm, Python and Flutter. Configure an Android emulator or physical device for mobile testing. Email OTP delivery requires working Brevo credentials and a verified sender.

### Clone

```bash
git clone https://github.com/IT24100136/FinCore-se3090.git
cd FinCore-se3090
```

Check out the team's integrated submission branch if it differs from the default branch.

### Backend

From the folder containing `FinCore.Api.csproj`, configure PostgreSQL, JWT, agent-service and Brevo settings, then run:

```bash
dotnet restore
dotnet build
dotnet run
```

Apply the committed EF Core migrations using `dotnet ef database update` if that is the repository's database setup procedure. Check its initializer and setup instructions first. Use the API address printed in the terminal.

### Python Agent Service

From `agentic-ai`, create and activate a virtual environment:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Install dependencies from the project's dependency file. If it uses `requirements.txt`:

```bash
pip install -r requirements.txt
```

Start FastAPI with the repository's documented entry point. The following is a template; replace the module and port:

```bash
uvicorn MODULE_NAME:app --host 127.0.0.1 --port AGENT_PORT
```

Set `AI_AGENT_URL` in the backend to this service's address and `FINCORE_API_URL` in the agent service to the backend address.

### React

From `web/FinCore-web`:

```bash
npm install
npm run dev
```

Set `VITE_API_URL` in the frontend environment configuration to the backend API address expected by the client. Open the Vite URL printed in the terminal.

### Flutter

From the mobile folder containing `pubspec.yaml`:

```bash
flutter pub get
flutter devices
flutter run
```

Configure the mobile application's backend address using its actual configuration mechanism. For an Android emulator, `10.0.2.2` refers to the host computer; physical devices require a reachable network address. Include the correct backend port and API path.

## Environment Variables

| Variable | Subsystem | Purpose |
|---|---|---|
| `AI_AGENT_URL` | Backend | Agent service address |
| `ASPNETCORE_ENVIRONMENT` | Backend | Application environment |
| `ConnectionStrings__DefaultConnection` | Backend | PostgreSQL connection string |
| `Jwt__Key` | Backend | JWT signing key |
| `Jwt__Issuer` | Backend | JWT issuer when configured as `Jwt:Issuer` |
| `EnableSwagger` | Backend | Swagger setting read by the application |
| `Brevo__ApiKey` | Backend | Brevo API credentials for OTP delivery |
| `Brevo__SenderEmail` | Backend | Verified OTP sender email |
| `Brevo__SenderName` | Backend | OTP sender display name |
| `DATABASE_URL` | Agent service | PostgreSQL connection URL |
| `FINCORE_API_URL` | Agent service | Backend API address |
| `VITE_API_URL` | React | Backend API address |

If the code explicitly reads `Jwt_Issuer`, use that exact name instead of `Jwt__Issuer`. Confirm all names against configuration reads in the source. Never commit API keys, database passwords, JWT signing keys or customer OTPs. Frontend environment variables are visible to users and must not contain secrets.

## Testing and CI

Run backend tests from the appropriate solution or test project directory:

```bash
dotnet test
```

Run mobile tests from the Flutter project:

```bash
flutter test
```

Use the repository's configured React test script and Python test runner. If the agent tests use pytest, run `pytest` in the agent environment.

Backend CI is defined in `.github/workflows/backend-ci.yml`. View results in GitHub's **Actions** tab. Test and benchmark results, evaluation cases and evidence are documented in Sections 5–7 of the final report; this README does not claim independently verified pass counts.

Key checks include permissions, repeated-decision prevention, independent second approvals, assignment persistence, OTP validation, wallet consistency and safe handling of agent-service failures.

## Contributors

| Member | Student ID | Component |
|---|---|---|
| Rathnayake R. M. T. S | IT24100012 | A |
| Rathnayake R. M. H. T | IT24100510 | B |
| Abeynayake D. A | IT24100971 | C |
| Karunarathna M. M. G. A. S | IT24100136 | D |

## Limitations

- Funding and transfers are simulated.
- Queue updates currently use polling; changes can take a few seconds to appear.
- Customer waiting-time estimates are approximate.
- Email verification depends on Brevo availability and correct sender configuration.

## Documentation and AI Disclosure

The consolidated report is **SEF_KDY_AI_09-Assignment1.pdf**. It contains architecture, API and database documentation, testing, deployment details, ADRs and individual contribution reports.

Development AI tools and their use are disclosed in the report. These development assistants are separate from the submitted runtime agent subsystem. Individual evidence and reflections remain the responsibility of each member.
