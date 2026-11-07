# Barber Junior — Réservation en ligne

Site de réservation (une seule page) pour Oussama Barber, Tabriquet, Salé.

- `index.html` : le site. Toute la configuration (services, prix, coiffeurs, horaires, WhatsApp) est dans l'objet `CONFIG` en haut du fichier.
- `backend/Code.gs` : backend Google Apps Script relié à la Google Sheet « Réservations Oussama Barber ».

Pour annuler une réservation : écrire `annulé` dans la colonne `statut` de la Sheet.
