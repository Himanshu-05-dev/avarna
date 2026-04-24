import os

def fix_imports(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # AppLayout
    content = content.replace('../../components/AppLayout/AppLayout', '../../../components/layout/AppLayout/AppLayout')
    # TopNav, Footer, Sidebar, etc. from pages (now features/*/components)
    content = content.replace('../../components/TopNav/TopNav', '../../../components/layout/TopNav/TopNav')
    content = content.replace('../../components/Footer/Footer', '../../../components/layout/Footer/Footer')
    content = content.replace('../../components/Sidebar/Sidebar', '../../../components/layout/Sidebar/Sidebar')
    
    # common components
    content = content.replace('../../components/ui/', '../../../components/common/')
    
    # mock data
    content = content.replace('../../data/mockData', '../../../utils/dummyData')
    
    # Dashboard StatCard
    content = content.replace('../../components/StatCard/StatCard', './StatCard/StatCard')
    content = content.replace('../StatCard/StatCard', './StatCard/StatCard')
    
    with open(file_path, 'w') as f:
        f.write(content)

base_path = '/Users/home/Desktop/YourCrawl/YourCrawl/Frontend/src'
for root, dirs, files in os.walk(base_path):
    for file in files:
        if file.endswith('.jsx'):
            fix_imports(os.path.join(root, file))
