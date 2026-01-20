// User Management Scripts

async function updateRole(userId, newRole) {
    try {
        const response = await fetch('/admin/api/users/' + userId + '/role', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
        
        if (response.ok) {
            window.location.reload();
        } else {
            alert('Failed to update role');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error updating role');
    }
}
