async function updateSellerRegistrationStatus(sellerId, status) {
  const res = await fetch(`/api/authorizer/seller-registrations/${sellerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message || 'Could not update seller registration status.');
    return false;
  }

  return true;
}

async function fetchSellerRegistrations() {
  const tbody = document.querySelector('#seller-approvals-table tbody');

  try {
    const res = await fetch('/api/authorizer/seller-registrations');
    const data = await res.json();

    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="7">${data.message || 'Access denied'}</td></tr>`;
      return;
    }

    if (!data.sellers.length) {
      tbody.innerHTML = '<tr><td colspan="7">No seller registrations yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.sellers
      .map(
        (seller) => `
          <tr>
            <td>${seller.id}</td>
            <td>${seller.username}</td>
            <td>${seller.email}</td>
            <td>${seller.phone || '-'}</td>
            <td>${new Date(seller.created_at).toLocaleString()}</td>
            <td>${seller.status}</td>
            <td>
              <button class="approve-btn" data-seller-id="${seller.id}">Approve</button>
              <button class="reject-btn" data-seller-id="${seller.id}">Reject</button>
            </td>
          </tr>
        `
      )
      .join('');

    document.querySelectorAll('.approve-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const sellerId = button.getAttribute('data-seller-id');
        const updated = await updateSellerRegistrationStatus(sellerId, 'approved');
        if (updated) {
          await fetchSellerRegistrations();
        }
      });
    });

    document.querySelectorAll('.reject-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const sellerId = button.getAttribute('data-seller-id');
        const updated = await updateSellerRegistrationStatus(sellerId, 'rejected');
        if (updated) {
          await fetchSellerRegistrations();
        }
      });
    });
  } catch (_error) {
    tbody.innerHTML = '<tr><td colspan="7">Could not load seller registrations.</td></tr>';
  }
}

window.addEventListener('DOMContentLoaded', fetchSellerRegistrations);
