
-- =============================================
-- Author:		pats relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[usp_PayrollSummary_List] 
	-- Add the parameters for the stored procedure here
		@filtertxt varchar(50),
		@idclientp INT, 
		@iddepartment int,
		@datestart date,
		@dateend date,
		@payrolldate date,
		@idclientbranch int,
		@trxtype nvarchar(20),
		@frequencypayment nvarchar(20)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Select statements for procedure here
	--DECLARE
	--	@idpayrollsum INT, 
	--	@idclientp INT, 
	--	@Date_Start DateTime

	--SET @idpayrollsum = 403 
	--SET @idclientp = 15 
	--SET @Date_Start = '2022-12-01'

SELECT        payroll_summary.idpayrollsum, payroll_summary.idclientp, payroll_summary.idclientbranchp, client_branch_position.jobposition, payroll_summary.Employee_id, Employee.lname + ' ' + Employee.fname AS empname, 
                         payroll_summary.Date_Start, payroll_summary.Date_End, payroll_summary.department_codep, payroll_summary.datalocked, payroll_summary.dupstag, payroll_summary.jobposition2, payroll_summary.dailyrate_payroll, 
                         Employee.fname, Employee.lname, payroll_summary.fname2, payroll_summary.lname2, payroll_summary.idclientbranchp AS Expr1, payroll_summary.idbranchpositionp, Employee.Position1, Employee.employee_status, 
                         client_branch_position.dailyratepayroll AS dailyratepayrolle, Employee.billingdailyrate,payroll_summary.trxtypep
FROM            payroll_summary INNER JOIN
                         greenhrismain.dbo.Employee ON payroll_summary.Employee_id = Employee.Employee_id INNER JOIN
                         client_branch_position ON payroll_summary.idbranchpositionp = client_branch_position.idbranchposition
WHERE payroll_summary.idclientp = @idclientp
AND payroll_summary.Date_Start = @datestart
AND payroll_summary.Date_End = @dateend
AND payroll_summary.payrolldate = @payrolldate
AND payroll_summary.department_codep = @iddepartment
and payroll_summary.idclientbranchp = @idclientbranch
and payroll_summary.trxtypep = @trxtype
AND payroll_summary.frequencypayment = @frequencypayment

AND (payroll_summary.fname2 LIKE '%' + @filtertxt + '%'
OR payroll_summary.lname2 LIKE '%' + @filtertxt + '%'
OR payroll_summary.jobposition2 LIKE '%' + @filtertxt + '%')
order by lname,fname
END



