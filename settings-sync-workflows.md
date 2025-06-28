# Settings Sync Workflows

This document contains the workflow diagrams for the Cockpit settings synchronization system, covering three main scenarios.

## Complete Workflow Diagram

```mermaid
graph TD
    %% Workflow 1: Cockpit Startup
    A1["🚀 Abriu o Cockpit"] --> B1["Veículo ainda não está conectado<br/>(sempre verdade)"]
    B1 --> C1["Criar backup dos settings<br/>v1 caso ainda não exista"]
    C1 --> D1{"Tem settings v2 para<br/>o último usuário/veículo guardados?"}

    D1 -->|SIM| E1["✅ Sucesso!<br/>Só usar!"]
    D1 -->|NÃO| F1{"Tem outro usuário/veículo<br/>com settings v2?"}

    F1 -->|SIM| G1["Copiar, dando preferência pra<br/>mesmo usuário e veículo NULL<br/>e depois usuário NULL e veículo NULL"]
    F1 -->|NÃO| G1

    G1 --> H1["Setar os atuais e loads"]
    E1 --> H1
    H1 --> I1["Notificar os listeners"]
    I1 --> J1["Synca tudo com o novo veículo"]

    %% Workflow 2: Vehicle Changed
    A2["🚁 Veículo mudou"] --> B2["Com certeza já existem<br/>bons usuário e veículo e<br/>settings pra eles!"]
    B2 --> C2["Synca todos os settings"]
    C2 --> D2{"Tem settings pro<br/>usuário atual/novo veículo?"}

    D2 -->|SIM| E2["✅ Sucesso!<br/>Só usar!"]
    D2 -->|NÃO| F2["Copia settings do usuário<br/>atual pro último veículo"]

    F2 --> G2["Setar os atuais e loads"]
    E2 --> G2
    G2 --> H2["Notificar os listeners"]
    H2 --> I2["Synca tudo com o novo veículo"]

    %% Workflow 3: User Changed
    A3["👤 Usuário mudou"] --> B3["Com certeza já existem<br/>bons usuário e veículo e<br/>settings pra eles!"]
    B3 --> C3{"Tem settings para o<br/>novo usuário e last veículo?"}

    C3 -->|SIM| D3["✅ Sucesso!<br/>Só usar!"]
    C3 -->|NÃO| E3{"Tem settings para o novo<br/>usuário e este veículo?"}

    E3 -->|SIM| F3["Copia settings do usuário<br/>atual pro último veículo"]
    E3 -->|NÃO| G3["Copiar, dando preferência pra<br/>veículo local NULL e por último<br/>para veículo NULL"]

    F3 --> H3["Setar os atuais e loads"]
    G3 --> H3
    D3 --> H3
    H3 --> I3["Notificar os listeners"]
    I3 --> J3["Synca tudo com o veículo atual"]

    %% Styling
    classDef startNode fill:#1976d2,stroke:#0d47a1,stroke-width:3px,color:#ffffff
    classDef successNode fill:#388e3c,stroke:#1b5e20,stroke-width:3px,color:#ffffff
    classDef decisionNode fill:#f57c00,stroke:#e65100,stroke-width:3px,color:#ffffff
    classDef actionNode fill:#7b1fa2,stroke:#4a148c,stroke-width:3px,color:#ffffff

    class A1,A2,A3 startNode
    class E1,E2,D3 successNode
    class D1,F1,D2,C3,E3 decisionNode
    class B1,C1,G1,H1,I1,J1,B2,C2,F2,G2,H2,I2,B3,F3,G3,H3,I3,J3 actionNode
```

## Workflow Descriptions

### 1. Cockpit Startup (Abriu o Cockpit)
**Trigger**: Application starts up
**Context**: Vehicle is not yet connected

**Key Logic**:
- Create backup of old settings for safety
- Check if settings exist for last user/vehicle combination
- If not found, look for any other user/vehicle with settings
- Copy with preference for same user + NULL vehicle, then NULL user + NULL vehicle
- Set current state and notify all listeners

### 2. Vehicle Changed (Veículo mudou)
**Trigger**: User switches to a different vehicle
**Context**: User and vehicle data should already exist

**Key Logic**:
- Sync all current settings first
- Check if settings exist for current user + new vehicle
- If not found, copy settings from current user to the new vehicle
- Update current state and sync everything with new vehicle

### 3. User Changed (Usuário mudou)
**Trigger**: User switches to a different user account
**Context**: User and vehicle data should already exist

**Key Logic**:
- Check if settings exist for new user + last vehicle
- If not found, check for new user + current vehicle
- Copy with preference for vehicle-local NULL, fallback to vehicle NULL
- Update current state and sync with current vehicle

## Implementation Notes

### Key Functions to Implement
- `createBackupOfOldSettings()` - Safety backup before major changes
- `checkSettingsExist(userId, vehicleId)` - Validation helper
- `copySettingsWithPreference()` - Smart copying logic
- `setCurrentAndLoad()` - State management
- `notifyListeners()` - Reactivity system
- `syncWithVehicle()` - Vehicle synchronization

### Edge Cases Handled
- NULL user/vehicle combinations
- Missing settings scenarios
- Preference-based copying
- Vehicle connectivity states

### Current Implementation Status
- ✅ Settings Manager (`src/libs/settings-management.ts`)
- ✅ Settings Syncer (`src/composables/settingsSyncer.ts`)
- ✅ Inspection Dialog (`src/components/SettingsInspectionDialog.vue`)
- 🔄 Workflow logic integration (in progress)

## Next Steps
1. Map workflow logic to existing SettingsManager methods
2. Implement user choice dialogs for ambiguous scenarios
3. Add backup creation functionality
4. Test all three workflows thoroughly
5. Handle edge cases and error scenarios