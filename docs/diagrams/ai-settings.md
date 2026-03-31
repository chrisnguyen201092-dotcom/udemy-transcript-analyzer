# Diagrams: AI Settings

## Flow Diagram

Settings uses a forced-modal pattern: the app is non-functional until Base URL, API Key, and model are all configured. Model list fetch doubles as API key validation.

```mermaid
flowchart TD
    A([App khoi dong]) --> B{localStorage co config?}
    B -->|Khong| FORCE[Mo SettingsModal bat buoc\nKhong the dong]
    B -->|Co| READY[App san sang]

    READY --> CLICK[User nhan bieu tuong gear]
    CLICK --> MODAL[Mo SettingsModal]
    FORCE --> FORM

    MODAL --> FORM[Hien thi form:\n- Base URL input\n- API Key input]
    FORM --> VALIDATE{Base URL hop le?}
    VALIDATE -->|Khong| URLERR[Hien thi loi URL]
    URLERR --> FORM
    VALIDATE -->|Co| FETCH[Nhan nut Tai danh sach model]
    FETCH --> POST[POST /api/ai/models\nvoi baseUrl + apiKey]
    POST --> RESP{Ket qua?}
    RESP -->|Loi| APIERR[Hien thi loi API key\nkhong hop le]
    APIERR --> FORM
    RESP -->|Thanh cong| DROP[Hien thi dropdown danh sach model]
    DROP --> SEL[User chon model]
    SEL --> SAVE[Nhan Save]
    SAVE --> CHECK{Tat ca truong bat buoc da dien?}
    CHECK -->|Chua| SAVEBLOCK[Nut Save bi vo hieu hoa]
    SAVEBLOCK --> FORM
    CHECK -->|Co| PERSIST[Luu vao localStorage:\nbaseUrl, apiKey, model]
    PERSIST --> CLOSE[Dong modal]
    CLOSE --> READY
```

## State Diagram

The Unconfigured state forces the modal open and blocks all other app interactions. Error can occur at either the model-fetch step or if saved credentials become invalid later.

```mermaid
stateDiagram-v2
    [*] --> Unconfigured : Lan dau khoi dong, chua co config

    Unconfigured --> Configuring : Mo SettingsModal bat buoc

    state Configuring {
        [*] --> FillingForm
        FillingForm --> ModelsFetching : Nhan Tai danh sach model
        ModelsFetching --> ModelsLoaded : Fetch model thanh cong
        ModelsFetching --> Error : API key sai hoac mang loi
        ModelsLoaded --> FillingForm : Chon model
        Error --> FillingForm : Nhap lai thong tin
    }

    Configuring --> Configured : Luu thanh cong

    Configured --> Configuring : Mo Settings de chinh sua

    Configured --> Error : API key het han hoac bi thu hoi

    Error --> Configuring : Mo Settings de cap nhat

    Configured --> [*]
```
