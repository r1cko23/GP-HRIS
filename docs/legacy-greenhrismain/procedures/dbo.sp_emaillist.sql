-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-15-2024>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[sp_emaillist]
	-- Add the parameters for the stored procedure here
		@idclient int,
		@fromdate date,
		@empid integer
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

if (@empid='')
BEGIN
SELECT        
payroll_summary.idpayrollsum
, payroll_summary.Employee_id
, payroll_summary.Date_Start
, payroll_summary.Date_End
, client.clientemailaddress
, Employee.pri_email
, Employee.lname
, Employee.fname
, Employee.mname
,payroll_summary.emailsentstatus
,payroll_summary.emailsentnumber
,client.contactperson
,emailpayslipready
,payslipdatesent
,payrollmonth

FROM            client INNER JOIN
                         payroll_summary ON client.idclient = payroll_summary.idclientp INNER JOIN
                         Employee ON payroll_summary.Employee_id = Employee.Employee_id
WHERE        (payroll_summary.Date_Start = @fromdate) 
			 AND (client.idclient = @idclient) and pri_email <>'' 
order by lname,fname
END


if(@empid <>'')  
BEGIN
SELECT        
payroll_summary.idpayrollsum
, payroll_summary.Employee_id
, payroll_summary.Date_Start
, payroll_summary.Date_End
, client.clientemailaddress
, Employee.pri_email
, Employee.lname
, Employee.fname
, Employee.mname
,payroll_summary.emailsentstatus
,payroll_summary.emailsentnumber
,client.contactperson
,emailpayslipready
,payslipdatesent
,payrollmonth

FROM            client INNER JOIN
                         payroll_summary ON client.idclient = payroll_summary.idclientp INNER JOIN
                         Employee ON payroll_summary.Employee_id = Employee.Employee_id
WHERE        (payroll_summary.Date_Start = @fromdate) 
			 AND (client.idclient = @idclient) 
			 AND pri_email <>''
			 AND Employee.Employee_id = @empid
			 			 
order by lname,fname
END


END
