-- =============================================
-- Author:		<Pat Relos>
-- Create date: <1-29-2025 1:18AM>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[sp_mandatoryforprocessinglist]
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
,payroll_summary.idclientp
,payroll_summary.department_codep
,payroll_summary.idclientbranchp
, payroll_summary.Employee_id
, payroll_summary.Date_Start
, payroll_summary.Date_End
, Employee.lname
, Employee.fname
, payroll_summary.companyname2
, payroll_summary.departmentdesc2
, payroll_summary.idclientbranchp
, payroll_summary.payrolldate
, payroll_summary.grossamttaxable
, payroll_summary.basic

, payrollmonth
, payroll_summary.frequencypayment
,wtaxsched2
,payroll_summary.trxtypep

FROM        client INNER JOIN
                         payroll_summary ON client.idclient = payroll_summary.idclientp INNER JOIN
                         Employee ON payroll_summary.Employee_id = Employee.Employee_id
WHERE mandatoryforprocessing ='Yes'
ORDER BY idpayrollsum,EMPLOYEE.lname,EMPLOYEE.fname


END
