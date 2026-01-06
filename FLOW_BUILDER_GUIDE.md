# Visual Flow Builder Guide

## 🎨 Overview

The Visual Flow Builder provides an intuitive, n8n-style interface for creating automation workflows. Build workflows by dragging and connecting nodes visually.

## 🚀 Accessing the Flow Builder

1. Navigate to `/settings/automations`
2. Click the **"Visual Builder"** button
3. Or go directly to `/settings/automations/flow`

## 🎯 How to Use

### 1. **Add a Trigger Node**
- Click on a trigger from the left sidebar (e.g., "Appointment Created")
- The trigger node appears on the canvas
- Only one trigger is allowed per workflow

### 2. **Configure the Trigger**
- Click on the trigger node to select it
- The right panel shows configuration options
- Select the event type (e.g., "Appointment Created")

### 3. **Add Conditions (Optional)**
- Click "Add Condition" from the sidebar
- Connect it to the trigger by dragging from the trigger's output handle
- Click the condition node to configure:
  - Set operator (AND/OR)
  - Add field conditions (e.g., `appointment.status = "scheduled"`)

### 4. **Add Actions**
- Click an action from the sidebar (e.g., "Draft Email", "Create Note")
- Connect it to the previous node
- Click the action node to configure:
  - Set action-specific parameters
  - Use dynamic values like `{appointment.patientId}`

### 5. **Connect Nodes**
- Drag from a node's **right handle** (output) to another node's **left handle** (input)
- Connections show the flow direction
- Nodes execute in sequence based on connections

### 6. **Save Your Workflow**
- Enter a workflow name at the top
- Click **"Save"** button
- The workflow is converted to an automation rule

## 🎨 Node Types

### **Trigger Nodes** (Green)
- **Purpose**: Define when the workflow starts
- **Examples**: Appointment Created, Patient Created
- **Configuration**: Select the event type

### **Condition Nodes** (Blue)
- **Purpose**: Add conditional logic
- **Configuration**: 
  - Operator: AND (all) or OR (any)
  - Field conditions with operators (equals, contains, exists)

### **Action Nodes** (Amber/Orange)
- **Purpose**: Perform actions
- **Types**:
  - **Draft Email**: Create an email draft
  - **Draft SMS**: Create an SMS draft
  - **Create Note**: Add a patient note
  - **Create Task**: Create a task (draft)
  - **Update Patient**: Update patient fields
  - **Delay**: Add a delay (stub)

## 💡 Tips

1. **Start with a Trigger**: Every workflow needs exactly one trigger
2. **Use Conditions Wisely**: Add conditions to filter when actions should run
3. **Chain Actions**: Connect multiple actions to run in sequence
4. **Dynamic Values**: Use `{field.path}` syntax for dynamic data (e.g., `{appointment.patientId}`)
5. **Node Labels**: Click a node and change its label in the right panel for clarity

## 🎨 Visual Features

- **Drag & Drop**: Move nodes around the canvas
- **Zoom & Pan**: Use mouse wheel to zoom, drag background to pan
- **Mini Map**: Bottom-right corner shows overview
- **Controls**: Top-left has zoom/pan controls
- **Node Colors**: 
  - Green = Triggers
  - Blue = Conditions
  - Amber = Actions

## 🔧 Keyboard Shortcuts

- **Delete**: Select a node and press Delete key (or use trash icon)
- **Click Background**: Deselect nodes
- **Scroll**: Zoom in/out

## 📊 Workflow Example

**"Welcome New Patients" Workflow:**
1. **Trigger**: Patient Created
2. **Condition**: (Optional) Check if email exists
3. **Action 1**: Create Note ("Welcome to our practice")
4. **Action 2**: Draft Email (Welcome email)

## 🚨 Common Issues

- **No Trigger**: You must add a trigger node first
- **Can't Connect**: Make sure you're dragging from output (right) to input (left)
- **Node Not Configuring**: Click the node to select it, then use the right panel

## 🎯 Next Steps

After saving, your workflow appears in the automation rules list. You can:
- Enable/disable it
- Test it
- Edit it (returns to flow builder)
- View execution history

Enjoy building your automations! 🚀

