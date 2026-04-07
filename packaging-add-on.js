// Packaging-add-on-script 
(function() {
  const checkbox = document.getElementById('add-bonus-product');
  if (!checkbox) return;

  const variantSelector = document.getElementById('packaging-variant-selector');
  const selectedVariantDisplay = document.getElementById('selected-variant-display');
  const variantOptions = document.getElementById('variant-options');
  const variantError = document.getElementById('variant-error');

  let isCheckboxChecked = false;
  let selectedVariantId = null;
  let selectedVariantTitle = '';
  let currentProductTitle = '';
  let inProcess = false;
  let isBuyNowProcess = false; // Flag to prevent double-add on Buy Now

  
  const productTitleElement = document.querySelector('.product__title') ||
    document.querySelector('.product-single__title') ||
    document.querySelector('h1');
  if (productTitleElement) {
    currentProductTitle = productTitleElement.textContent.trim();
  }

 
  function showError(message) {
    if (variantError) {
      variantError.textContent = message;
      variantError.style.display = 'block';
      variantSelector && variantSelector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      alert(message);
    }
  }

  function hideError() {
    if (variantError) {
      variantError.style.display = 'none';
      variantError.textContent = '';
    }
  }

  function resetVariantSelection() {
    checkbox.checked = false;
    isCheckboxChecked = false;
    if (variantSelector) variantSelector.style.display = 'none';
    if (variantOptions) variantOptions.classList.remove('open');
    if (selectedVariantDisplay) {
      selectedVariantDisplay.innerHTML = '<span class="placeholder-text">Select a variant...</span>';
    }
    selectedVariantId = null;
    selectedVariantTitle = '';
    document.querySelectorAll('.variant-option').forEach(opt => opt.classList.remove('selected'));
    hideError();
  }

 
  checkbox.addEventListener('change', function() {
    isCheckboxChecked = checkbox.checked;
    if (isCheckboxChecked) {
      if (variantSelector) {
        variantSelector.style.display = 'block';
        variantSelector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      resetVariantSelection();
    }
  });

 
  if (selectedVariantDisplay) {
    selectedVariantDisplay.addEventListener('click', function(e) {
      e.stopPropagation();
      if (variantOptions) variantOptions.classList.toggle('open');
    });
  }

  document.addEventListener('click', function(e) {
    if (variantOptions && !variantOptions.contains(e.target) && 
        selectedVariantDisplay && !selectedVariantDisplay.contains(e.target)) {
      variantOptions.classList.remove('open');
    }
  });

  
  document.querySelectorAll('.variant-option').forEach(option => {
    option.addEventListener('click', function(e) {
      e.stopPropagation();
      document.querySelectorAll('.variant-option').forEach(opt => opt.classList.remove('selected'));
      this.classList.add('selected');
      
      selectedVariantId = this.getAttribute('data-variant-id');
      selectedVariantTitle = (this.getAttribute('data-variant-title') || '') + ' - ' + 
                            (this.getAttribute('data-variant-price') || '');
      hideError();
      
      const img = this.querySelector('.variant-image');
      const imgHtml = img ? `<img src="${img.src}" alt="${selectedVariantTitle}" class="variant-image">` : '';
      
      if (selectedVariantDisplay) {
        selectedVariantDisplay.innerHTML = `
          ${imgHtml}
          <span class="variant-title">${this.getAttribute('data-variant-title') || ''}</span>
          <span class="variant-price">${this.getAttribute('data-variant-price') || ''}</span>
        `;
      }
      if (variantOptions) variantOptions.classList.remove('open');
    });
  });

  
  function findMainProductInfo(clickedButton) {
    
    const form = clickedButton ? clickedButton.closest('form') : null;
    const container = form || 
                     document.querySelector('form[action*="/cart/add"]') || 
                     document.querySelector('.product-form') || 
                     document.querySelector('form');

    if (!container) return null;

    
    let variantInput = container.querySelector('input[name="id"]:checked') ||
                      container.querySelector('select[name="id"]') ||
                      container.querySelector('input[name="id"][type="hidden"]') ||
                      container.querySelector('input[name="id"]');

    
    if (!variantInput) {
      const datasetId = container.getAttribute('data-product-variant-id') ||
                       (container.querySelector('[data-product-variant-id]') && 
                        container.querySelector('[data-product-variant-id]').getAttribute('data-product-variant-id'));
      if (datasetId) {
        variantInput = { value: datasetId };
      }
    }

    const qtyInput = container.querySelector('input[name="quantity"]') || 
                    container.querySelector('input[data-qty]');

    const variantId = variantInput ? variantInput.value : null;
    const quantity = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

    return variantId ? { id: variantId.toString(), quantity } : null;
  }

 
  function clearCart() {
    return fetch('/cart/clear.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
  }

 
  function addItemsToCart(items, opts = { redirectToCheckout: false, clearFirst: false }) {
    if (inProcess) return Promise.reject(new Error('processing'));
    inProcess = true;

    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

   
    const startPromise = opts.clearFirst ? clearCart() : Promise.resolve();

    return startPromise
    .then(() => {
      
      return fetch('/cart/add.js', {
        method: 'POST',
        headers,
        body: JSON.stringify({ items })
      })
      .then(response => {
        if (response.ok) return response.json();
        
        throw new Error('Batch add failed');
      })
      .catch(() => {
       
        const main = items && items[0] ? items[0] : null;
        const addon = items && items.length > 1 ? items[1] : null;

        if (!main) {
          inProcess = false;
          return Promise.reject(new Error('No main product info'));
        }

       
        return fetch('/cart/add.js', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: main.id,
            quantity: main.quantity,
            properties: main.properties || {}
          })
        })
        .then(resp => {
          if (!resp.ok) throw new Error('Failed to add main product');
          if (!addon) return resp.json();
          
          
          return fetch('/cart/add.js', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              id: addon.id,
              quantity: addon.quantity || 1,
              properties: addon.properties || {}
            })
          }).then(aResp => {
            if (!aResp.ok) throw new Error('Failed to add packaging');
            return aResp.json();
          });
        });
      });
    })
    .then(result => {
      inProcess = false;
      
      
      fetch('/cart.js', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(r => r.json())
        .then(cartData => {
          document.documentElement.dispatchEvent(
            new CustomEvent('cart:refresh', { detail: cartData, bubbles: true })
          );
        })
        .catch(() => {});

     
      if (!opts.redirectToCheckout) {
        resetVariantSelection();
      }

      if (opts.redirectToCheckout) {
        window.location.href = '/checkout';
      }
      return result;
    })
    .catch(err => {
      inProcess = false;
      return Promise.reject(err);
    });
  }

 
  document.addEventListener('click', function(e) {
   
    const btn = e.target.closest('[name="checkout"], .shopify-payment-button__button, [data-shopify="payment-button"], .product-form__cart-submit--buy-now, .buy-now, .product-form__buy-now');
    
   
    if (!btn || btn.closest('.cart-drawer, .drawer, [data-cart-drawer], .mini-cart, .cart-popup')) return;
    
    if (inProcess || isBuyNowProcess) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    
    if (isCheckboxChecked && !selectedVariantId) {
      e.preventDefault();
      e.stopPropagation();
      showError('*Please select a packaging variant before checkout.');
      return false;
    }

    
    e.preventDefault();
    e.stopPropagation();
    isBuyNowProcess = true; // Set flag to prevent fetch interception

    const mainInfo = findMainProductInfo(btn);
    if (!mainInfo) {
      showError('Unable to find the product variant. Please select a variant and try again.');
      isBuyNowProcess = false;
      return false;
    }

    
    const items = [{
      id: mainInfo.id,
      quantity: mainInfo.quantity,
      properties: {
        '_Premium Packaging': isCheckboxChecked ? 'Yes' : 'No',
     
      }
    }];

    if (isCheckboxChecked && selectedVariantId) {
      items.push({
        id: selectedVariantId,
        quantity: 1,
        properties: {
          '_For Product': currentProductTitle || 'Unknown Product'
        }
      });
    }

    const origDisabled = btn.disabled;
    btn.disabled = true;

    addItemsToCart(items, { redirectToCheckout: true, clearFirst: true })
      .catch(err => {
        const msg = (err && err.message) ? err.message : 'Error adding product(s). Please try again.';
        showError(msg);
        btn.disabled = origDisabled;
        isBuyNowProcess = false;
      });

    return false;
  }, true);

  
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    
    if (typeof url === 'string' && (url.includes('/cart/add') || url === '/cart/add.js')) {
      
      
      if (isBuyNowProcess) {
        return originalFetch.apply(this, args);
      }
      
    
      if (isCheckboxChecked && !selectedVariantId) {
        showError('*Please select a packaging variant.');
        return Promise.reject(new Error('No packaging variant selected'));
      }

      
      
      return originalFetch.apply(this, args)
        .then(response => {
         
          if (isCheckboxChecked && selectedVariantId && response.ok) {
            return originalFetch('/cart/add.js', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({
                id: selectedVariantId,
                quantity: 1,
                properties: {
                  '_For Product': currentProductTitle || 'Unknown Product'
                }
              })
            })
            .then(packagingResponse => packagingResponse.json())
            .then(() => {
              
              resetVariantSelection();
              
              
              document.documentElement.dispatchEvent(
                new CustomEvent('cart:refresh', { bubbles: true })
              );
              
              return response;
            })
            .catch(error => {
              showError('Error adding premium packaging. Please try again.');
              return response;
            });
          } else {
            
            if (isCheckboxChecked) {
              resetVariantSelection();
            }
            return response;
          }
        });
    }
    
  
    return originalFetch.apply(this, args);
  };

})();
