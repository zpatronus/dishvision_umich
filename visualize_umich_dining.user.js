// ==UserScript==
// @name         Visualize UMich Dining
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Adds buttons to copy food name to clipboard, search in Google Images, and automatically display images using Google Image Search API for specific sections in UMich Dining's page. It caches images in localStorage for up to 20 days.
// @author       zPatronus
// @match        https://dining.umich.edu/menus-locations/dining-halls/*
// @grant        GM_xmlhttpRequest
// @connect      www.googleapis.com
// @updateURL    https://github.com/zpatronus/visualize_umich_dining/raw/main/visualize_umich_dining.user.js
// @downloadURL  https://github.com/zpatronus/visualize_umich_dining/raw/main/visualize_umich_dining.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CX = '51db3fa032b5d4485';  // Your Custom Search Engine ID
  let apiKey = localStorage.getItem('googleApiKey') || '';  // Get API key from localStorage or set to empty
  let apiCounter = JSON.parse(localStorage.getItem('apiCounterData')) || { count: 0, date: new Date().toDateString() };
  let lovedItems = JSON.parse(localStorage.getItem('lovedItems')) || []; // Retrieve loved items list from localStorage
  const MAX_API_REQUESTS = 100;
  const CACHE_DURATION = 20; // Cache duration in 20 days
  const autoSearchSections = ["Signature Maize", "Signature Blue", "Halal", "Two Oceans", "Wild Fire Maize", "Wild Fire Blue"];
  const IMAGE_CACHE = JSON.parse(localStorage.getItem('imageCache')) || {}; // Image cache stored in localStorage

  const foodNameToLoveButtons = {}; // Map to store love buttons for each food name

  function getTodayLovedItemsCount () {
    const menuItems = Array.from(document.querySelectorAll('.item-name')).map(item => item.textContent.trim());
    const uniqueMenuItems = [...new Set(menuItems)]; // Remove duplicates
    const lovedToday = uniqueMenuItems.filter(item => lovedItems.includes(item));
    return lovedToday.length;
  }

  function displayLovedItemsCount () {
    const menuTitle = document.querySelector('h2.menuTitle');
    if (menuTitle) {
      const lovedCount = getTodayLovedItemsCount();
      let lovedCountLine = document.getElementById('lovedCountLine');
      if (!lovedCountLine) {
        lovedCountLine = document.createElement('div');
        lovedCountLine.id = 'lovedCountLine';
        lovedCountLine.style.marginTop = '10px';
        lovedCountLine.style.fontSize = '1em';
        menuTitle.insertAdjacentElement('afterend', lovedCountLine);
      }
      lovedCountLine.textContent = `${lovedCount} of your favorite item(s) are on today's menu.`;
    }
  }

  function checkAndResetDailyData () {
    const today = new Date().toDateString();
    if (apiCounter.date !== today) {
      apiCounter = { count: 0, date: today };
      localStorage.setItem('apiCounterData', JSON.stringify(apiCounter));
      cleanOldCache();
    }
  }

  function checkImageCache (query) {
    const cachedImageData = IMAGE_CACHE[query];
    if (cachedImageData) {
      IMAGE_CACHE[query].date = new Date().toDateString();
      localStorage.setItem('imageCache', JSON.stringify(IMAGE_CACHE));
      return cachedImageData.images;
    }
    return null;
  }

  function updateImageCache (query, images) {
    IMAGE_CACHE[query] = { images, date: new Date().toDateString() };
    localStorage.setItem('imageCache', JSON.stringify(IMAGE_CACHE));
  }

  function isCacheValid (cacheDate) {
    const today = new Date();
    const cachedDate = new Date(cacheDate);
    const differenceInDays = Math.floor((today - cachedDate) / (1000 * 60 * 60 * 24));
    return differenceInDays <= CACHE_DURATION;
  }

  function cleanOldCache () {
    for (const query in IMAGE_CACHE) {
      if (!isCacheValid(IMAGE_CACHE[query].date)) {
        delete IMAGE_CACHE[query];
      }
    }
    localStorage.setItem('imageCache', JSON.stringify(IMAGE_CACHE));
    console.log('Old cache entries cleared.');
  }

  function toggleLovedStatus (foodName) {
    const lovedIndex = lovedItems.indexOf(foodName);
    if (lovedIndex === -1) {
      lovedItems.push(foodName);
      console.log(`Added to loved items: ${foodName}`);
    } else {
      lovedItems.splice(lovedIndex, 1);
      console.log(`Removed from loved items: ${foodName}`);
    }
    localStorage.setItem('lovedItems', JSON.stringify(lovedItems));

    // Update all love buttons for this food name
    const buttons = foodNameToLoveButtons[foodName] || [];
    buttons.forEach(button => {
      if (lovedItems.includes(foodName)) {
        button.style.backgroundColor = 'yellow';
      } else {
        button.style.backgroundColor = '';
      }
    });

    // Update the loved items count display
    displayLovedItemsCount();
  }

  function addButtonsToFoodItems () {
    const foodSections = document.querySelectorAll('h4'); // Target the section headers
    foodSections.forEach(section => {
      const sectionName = section.textContent.trim();
      const foodItems = section.nextElementSibling.querySelectorAll('li'); // Target food items within each section

      foodItems.forEach(item => {
        const foodNameDiv = item.querySelector('.item-name');
        if (foodNameDiv) {
          const foodName = foodNameDiv.textContent.trim();
          console.log('Processing food item:', foodName);

          const buttonContainer = document.createElement('div');
          buttonContainer.style.marginTop = '5px';

          const copyButton = document.createElement('button');
          copyButton.innerText = 'Copy';
          copyButton.style.marginRight = '5px';
          copyButton.style.fontSize = '0.8em';
          copyButton.style.padding = '2px 5px';
          copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(foodName);
            console.log(`Copied food name to clipboard: ${foodName}`);
          });

          const searchButton = document.createElement('button');
          searchButton.innerText = 'Search Image';
          searchButton.style.marginRight = '5px';
          searchButton.style.fontSize = '0.8em';
          searchButton.style.padding = '2px 5px';
          searchButton.addEventListener('click', () => {
            const googleSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(foodName)}`;
            window.open(googleSearchUrl, '_blank');
            console.log(`Opened Google Images for: ${foodName}`);
          });

          const loveButton = document.createElement('button');
          loveButton.innerText = 'Love it!';
          loveButton.style.fontSize = '0.8em';
          loveButton.style.padding = '2px 5px';

          if (lovedItems.includes(foodName)) {
            loveButton.style.backgroundColor = 'yellow';
          }

          loveButton.addEventListener('click', () => {
            toggleLovedStatus(foodName);
          });

          // Add the love button to the mapping
          if (!foodNameToLoveButtons[foodName]) {
            foodNameToLoveButtons[foodName] = [];
          }
          foodNameToLoveButtons[foodName].push(loveButton);

          buttonContainer.appendChild(copyButton);
          buttonContainer.appendChild(searchButton);
          buttonContainer.appendChild(loveButton);
          item.querySelector('a').insertAdjacentElement('afterend', buttonContainer);

          if (autoSearchSections.includes(sectionName)) {
            const cachedImages = checkImageCache(foodName);
            if (cachedImages) {
              console.log(`Using cached images for: ${foodName}`);
              displayImages(cachedImages, item);
            } else if (apiKey && apiCounter.count < MAX_API_REQUESTS) {
              fetchGoogleImages(foodName, item);
            } else if (apiCounter.count >= MAX_API_REQUESTS) {
              console.log('API request limit reached. Auto search disabled.');
            }
          }
        }
      });
    });

    displayApiCounter();
  }

  function fetchGoogleImages (query, itemElement) {
    const googleSearchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${CX}&key=${apiKey}&searchType=image&num=5`;

    if (apiCounter.count >= MAX_API_REQUESTS) {
      console.log('API request limit reached. Cannot perform search.');
      return;
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url: googleSearchUrl,
      onload: function (response) {
        try {
          const data = JSON.parse(response.responseText);
          console.log('Google Custom Search API response:', data);

          if (data.items && data.items.length > 0) {
            const images = data.items.map(item => item.image.thumbnailLink);
            displayImages(images, itemElement);
            updateImageCache(query, images);
          } else {
            console.warn(`No images found for: ${query}`);
          }
        } catch (error) {
          console.error('Error parsing Google API response for:', query, 'Error:', error);
        } finally {
          apiCounter.count++;
          localStorage.setItem('apiCounterData', JSON.stringify(apiCounter));
          console.log(`API Requests Made: ${apiCounter.count}`);
        }
      },
      onerror: function (error) {
        console.error('Failed to fetch images for:', query, 'Error:', error);
        apiCounter.count++;
        localStorage.setItem('apiCounterData', JSON.stringify(apiCounter));
        console.log(`API Requests Made: ${apiCounter.count}`);
      }
    });
  }

  function displayImages (images, itemElement) {
    const imageContainer = document.createElement('div');
    imageContainer.style.marginTop = '10px';
    images.forEach((imageLink, index) => {
      const img = document.createElement('img');
      img.src = imageLink;
      img.alt = `Image ${index + 1}`;
      img.style.width = '110px';
      img.style.height = '110px';
      img.style.marginRight = '5px';
      img.style.objectFit = 'cover';
      imageContainer.appendChild(img);
    });
    itemElement.appendChild(imageContainer);
  }

  function createApiKeyInput () {
    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password';
    apiKeyInput.placeholder = 'Enter API Key';
    apiKeyInput.style.position = 'fixed';
    apiKeyInput.style.bottom = '10px';
    apiKeyInput.style.right = '10px';
    apiKeyInput.style.width = '120px';
    apiKeyInput.style.padding = '2px';
    apiKeyInput.style.fontSize = '0.9em';
    apiKeyInput.style.border = '1px solid #ccc';
    apiKeyInput.title = 'Enter your Google API key to enable auto image search.';

    if (apiKey) {
      apiKeyInput.value = apiKey;
    }

    apiKeyInput.addEventListener('input', (event) => {
      apiKey = event.target.value.trim();
      console.log('API key set:', apiKey);
      localStorage.setItem('googleApiKey', apiKey);
    });

    const toggleButton = document.createElement('button');
    toggleButton.innerText = 'Show';
    toggleButton.style.position = 'fixed';
    toggleButton.style.bottom = '10px';
    toggleButton.style.right = '140px';
    toggleButton.style.fontSize = '0.8em';
    toggleButton.style.padding = '2px';

    toggleButton.addEventListener('click', () => {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleButton.innerText = 'Hide';
      } else {
        apiKeyInput.type = 'password';
        toggleButton.innerText = 'Show';
      }
    });

    document.body.appendChild(apiKeyInput);
    document.body.appendChild(toggleButton);
  }

  function displayApiCounter () {
    console.log(`API Requests Made Today: ${apiCounter.count}`);
  }

  window.addEventListener('load', () => {
    checkAndResetDailyData();
    addButtonsToFoodItems();
    createApiKeyInput();
    displayLovedItemsCount();
  });
})();
