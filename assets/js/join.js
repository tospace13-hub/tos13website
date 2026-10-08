// Join form: sends the answers to the Google Apps Script web app in the form's
// action (site.join_form_endpoint) and shows the result in place.
// Without JavaScript the browser posts the form to the same address.
(function () {
  var form = document.getElementById('join-form');
  if (!form) return;

  var status = document.getElementById('join-status');
  var thanks = document.getElementById('join-thanks');
  var button = form.querySelector('button[type="submit"]');
  var tiers = form.querySelectorAll('input[name="tier"]');
  var failMessage = 'Sorry, that did not go through. Please try again, or email hello@space13.to.';

  form.elements.started_at.value = Date.now();

  // Checkbox groups have no built-in "at least one" rule, so check the value-chain group here.
  function checkTiers() {
    var anyChecked = Array.prototype.some.call(tiers, function (box) { return box.checked; });
    tiers[0].setCustomValidity(anyChecked ? '' : 'Choose at least one option.');
  }
  Array.prototype.forEach.call(tiers, function (box) { box.addEventListener('change', checkTiers); });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    checkTiers();
    if (!form.reportValidity()) return;
    if (!form.getAttribute('action')) {
      status.textContent = failMessage;
      return;
    }

    button.disabled = true;
    status.textContent = 'Sending…';

    fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)) })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        if (!result.ok) throw new Error(result.error || 'Not saved');
        form.hidden = true;
        thanks.hidden = false;
        thanks.focus();
      })
      .catch(function () {
        status.textContent = failMessage;
        button.disabled = false;
      });
  });
})();
