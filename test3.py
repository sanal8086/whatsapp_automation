import os

import requests


def send_template_message():
	access_token = "EAAZAOUAFYFIABSiWJLLbrgoZAktKxuisREheCRQNzsyXPyphwAZCSwqHATSz49suNVXm7NDlPXZCOfOUZBCIuA8rbTbVSmMuAajOKuyill69qafVPf6lOHlfwmkU2D0muYuDoOCBZAeNCwtIk6wSR3xyCpBcDwZCzl1ID0XQpMe4NNBjd8MYedJZCjG6BVfmUgZDZD"
	if not access_token:
		raise RuntimeError("Set the WHATSAPP_ACCESS_TOKEN environment variable.")

	url = "https://graph.facebook.com/v25.0/1380171298507513/messages"
	headers = {
		"Authorization": f"Bearer {access_token}",
		"Content-Type": "application/json",
	}
	payload = {
		"messaging_product": "whatsapp",
		"to": "8086438990", # TO NUMBER
		"type": "template",
		"template": {
			"name": "hellopets",  # TEMPLATE NAME
			"language": {"code": "en_US"},
		},
	}

	response = requests.post(url, headers=headers, json=payload, timeout=30)
	response.raise_for_status()
	print(response.json())


if __name__ == "__main__":
	send_template_message()
