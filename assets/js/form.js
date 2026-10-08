// Sends a form to the Google Apps Script web app in its action
// (site.join_form_endpoint) and shows the result in place. Used by /join/ and
// /unsubscribe/: every form with a data-thanks attribute. Without JavaScript
// the browser posts the form to the same address.
(function () {
  var failMessage = 'Sorry, that did not go through. Please try again, or email hello@space13.to.';
  var forms = document.querySelectorAll('form[data-thanks]');

  Array.prototype.forEach.call(forms, function (form) {
    var status = form.querySelector('.form-status');
    var thanks = document.getElementById(form.getAttribute('data-thanks'));
    var button = form.querySelector('button[type="submit"]');
    var groups = form.querySelectorAll('[data-require-one]');

    form.elements.started_at.value = Date.now();

    // Prefill the address from a link such as /unsubscribe/?email=name@example.nl
    var email = new URLSearchParams(location.search).get('email');
    if (email && form.elements.email) form.elements.email.value = email;

    // Checkbox groups have no built-in "at least one" rule, so check the marked groups here.
    function checkGroups() {
      Array.prototype.forEach.call(groups, function (group) {
        var boxes = group.querySelectorAll('input[type="checkbox"]');
        var anyChecked = Array.prototype.some.call(boxes, function (box) { return box.checked; });
        boxes[0].setCustomValidity(anyChecked ? '' : 'Choose at least one option.');
      });
    }
    form.addEventListener('change', checkGroups);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      checkGroups();
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
  });
})();
