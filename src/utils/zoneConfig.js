import { rgb } from 'pdf-lib';

export const getZoneConfig = (zone) => {
    
    switch (zone.toLowerCase()) {
      case 'a':
        return {
          primaryColor: rgb(0.69, 0.18, 0.51), 
          ticketHeaderImagePath: './src/templates/zone_a_participant_ticket_header.png',
          generalHeaderImagePath: './src/templates/zone_a_header.png',
          footerText: ["Kindly submit the A-zone copy along with the following documents to the Program Office on or before 20th January.", "A copy of your SSLC Book.", "A copy of your Hall Ticket."]
        };
      case 'c':
        return {
          primaryColor: rgb(0.52, 0.45, 0.19), 
          ticketHeaderImagePath: './src/templates/zone_c_participant_ticket_header.png',
          generalHeaderImagePath: './src/templates/zone_c_header.png',
          footerText: ["Kindly submit the C-zone copy along with the following documents to the Program Office on or before 13th January.", "A copy of your SSLC Book.", "A copy of your Hall Ticket."]
        };
      default:
        return null;
    }
};
