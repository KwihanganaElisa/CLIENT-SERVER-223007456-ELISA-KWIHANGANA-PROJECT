from django.db import models

class Client(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'clients' # <-- ADD THIS

    def __str__(self):
        return self.name

class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('unpaid', 'Unpaid'),
        ('paid', 'Paid'),
        ('void', 'Void'),
    ]
    client = models.ForeignKey(Client, on_delete=models.RESTRICT, related_name='invoices')
    invoice_no = models.BigIntegerField(unique=True, null=True, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'invoices' # <-- ADD THIS

    def __str__(self):
        return f"Invoice #{self.invoice_no} for {self.client.name}"

class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='lines')
    item = models.CharField(max_length=255)
    qty = models.IntegerField()
    price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'invoice_lines' # <-- ADD THIS

    def __str__(self):
        return f"{self.qty} x {self.item}"
