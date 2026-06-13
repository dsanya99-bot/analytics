'use strict';

const form = document.getElementById('login-form');
const errEl = document.getElementById('error');

const submitBtn = document.getElementById('submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.textContent = '';
  const password = document.getElementById('password').value;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Входим…';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      window.location.href = '/cabinet';
    } else {
      errEl.textContent = data.error || 'Ошибка входа';
    }
  } catch (_) {
    errEl.textContent = 'Сеть недоступна. Попробуйте ещё раз.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Войти';
  }
});
