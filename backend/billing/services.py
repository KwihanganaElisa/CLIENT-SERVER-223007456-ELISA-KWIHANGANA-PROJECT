from django.db import transaction
from .models import Invoice, InvoiceLine
from decimal import Decimal

def create_invoice_with_lines(client_id, status, lines_data):
    """
    Safely creates an invoice, locks the sequence to prevent duplicate numbers,
    and calculates the total on the server (ignoring any client total).
    """
    with transaction.atomic():
        # 1. Lock the invoice table to prevent two simultaneous inserts from getting the same number
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("LOCK TABLE invoices IN EXCLUSIVE MODE;")
            
            # 2. Get the next sequence number
            cursor.execute("SELECT nextval('invoice_no_seq');")
            next_invoice_no = cursor.fetchone()[0]

        # 3. Create the Invoice
        invoice = Invoice.objects.create(
            client_id=client_id,
            invoice_no=next_invoice_no,
            status=status,
            total=0 # Will calculate below
        )

        # 4. Create the lines and calculate the total
        total = Decimal('0.00')
        for line in lines_data:
            qty = int(line['qty'])
            price = Decimal(str(line['price']))
            line_total = qty * price
            total += line_total
            
            InvoiceLine.objects.create(
                invoice=invoice,
                item=line['item'],
                qty=qty,
                price=price
            )

        # 5. Update the invoice with the server-calculated total
        invoice.total = total
        invoice.save()

        return invoice