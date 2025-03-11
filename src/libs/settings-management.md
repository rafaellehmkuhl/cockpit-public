```mermaid
graph TD;
    1[Cockpit opens]-->2A[Retrieve lastConnectedUser and lastConnectedVehicle from storage]
    2A-->2B[Set currentUser=lastConnectedUser and currentVehicle=lastConnectedVehicle]
    2B-->3{Cockpit has settings 2.0?}
    3-->|No| 3A[Copy settings 1.0 to user=currentUser/vehicle=currentVehicle]
    3A-->3A1[Load settings for user=currentUser and vehicle=currentVehicle]
    3A1-->4[Waiting for vehicle connection...]
    3-->|Yes| 3B{Cockpit has settings 2.0 for user=currentUser and vehicle=currentVehicle?}
    3B-->|No| 3B1[Copy settings from user=lastConnectedUser/vehicle=lastConnectedVehicle to user=currentUser/vehicle=currentVehicle]
    3B1-->3B1A[Set lastConnectedUser=currentUser and lastConnectedVehicle=currentVehicle]
    3B1A-->3A1
    3B-->|Yes| 3A1
    4-->5A[User chooses to switch user!]
    4-->5B[Vehicle XYZ connects!]
    5A-->5A1[Set currentUser=lastConnectedUser]-->3B
    5B-->6[Set currentVehicle=XYZ]
    6-->3B
```