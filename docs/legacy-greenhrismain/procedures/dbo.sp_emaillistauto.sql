-- =============================================
-- Author:		<Pat Relos>
-- Create date: <1-29-2025 1:18AM>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
create PROCEDURE  [dbo].[sp_emaillistauto]
	-- Add the parameters for the stored procedure here
	--	@idclient int,
	--	@fromdate date
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
SELECT  top 15        
payroll_summary.idpayrollsum
, payroll_summary.Employee_id
, payroll_summary.Date_Start
, payroll_summary.Date_End
, client.clientemailaddress
, Employee.pri_email
, Employee.lname
, Employee.fname
,payroll_summary.emailsentstatus
,payroll_summary.emailsentnumber
,client.contactperson
,emailpayslipready
,payrollmonth

FROM        client INNER JOIN
                         payroll_summary ON client.idclient = payroll_summary.idclientp INNER JOIN
                         Employee ON payroll_summary.Employee_id = Employee.Employee_id
WHERE       emailpayslipready ='Y' 	and emailsentnumber  is null and Employee.pri_email <> ''
ORDER BY EMPLOYEE.lname,EMPLOYEE.fname


END
