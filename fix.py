import os

file_path = r'C:\Users\SCGBS\Padmanabha_das\Home\InfoYashonanada\InsuMitraFinal_20072026\Frontend\src\pages\Workspace\index.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
import_idx = content.find('import WorkspaceKpiCards')
if import_idx != -1:
    end_import_idx = content.find('\n', import_idx) + 1
    content = content[:end_import_idx] + "import UnifiedTaskActivityLog from './components/UnifiedTaskActivityLog';\n" + content[end_import_idx:]

# 2. Remove Tasks tab button
tab_btn_start = content.find('<button\n          onClick={() => setActiveTab(\'tasks\')}')
if tab_btn_start != -1:
    tab_btn_end = content.find('</button>', tab_btn_start) + len('</button>')
    content = content[:tab_btn_start] + "{/* Tasks tab removed */}" + content[tab_btn_end:]

# 3. Replace TAB 1 and TAB 2 with UnifiedTaskActivityLog
tab1_start = content.find('{/* TAB 1: OVERVIEW */}')
tab4_start = content.find('{/* TAB 4: MY TARGETS & COMMISSIONS */}')
if tab1_start != -1 and tab4_start != -1:
    new_tab1 = """{/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <UnifiedTaskActivityLog 
          tasks={filteredTasksList} 
          employeesList={employeesList}
          onToggleTask={handleToggleTask}
          onAddTask={(payload) => createTaskMutation.mutate(payload, { onSuccess: () => refetch() })}
          isViewOnly={!!selectedEmployeeUserId}
        />
      )}

      """
    content = content[:tab1_start] + new_tab1 + content[tab4_start:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('File updated successfully.')
